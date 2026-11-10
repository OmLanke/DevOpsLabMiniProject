#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

project="notes-dr-${$}-$(date +%s)"
compose=(docker compose --env-file "$ROOT/.env.example" --project-name "$project" -f "$ROOT/docker-compose.yml")
export APP_PORT=0 MINIO_PORT=0 MINIO_CONSOLE_PORT=0
snapshot=$(mktemp "${TMPDIR:-/tmp}/notes-recovery.XXXXXX")

cleanup() {
  result=$?
  if (( result != 0 )); then "${compose[@]}" logs --no-color >&2 || true; fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "$snapshot"
  return "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo 'Starting isolated PostgreSQL, API, MinIO, and backup worker...'
"${compose[@]}" up -d --build
app_url="http://$("${compose[@]}" port app 3000)"
for attempt in $(seq 1 60); do
  if curl -fsS "$app_url/health" >/dev/null; then break; fi
  if (( attempt == 60 )); then echo 'API did not become healthy.' >&2; exit 1; fi
  sleep 2
done
curl -fsS "$app_url/" >/dev/null
curl -fsS "$app_url/styles.css" >/dev/null
curl -fsS "$app_url/app.js" >/dev/null
echo 'Browser notes workspace and assets are served by the container.'

python3 - "$app_url" "$snapshot" <<'PY'
import json, sys, urllib.request
base, snapshot = sys.argv[1:]
for title, content in [('Recover me', 'original-one'), ('Also recover me', 'original-two')]:
    request = urllib.request.Request(base + '/notes', data=json.dumps({'title': title, 'content': content}).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request) as response:
        assert response.status == 201
with urllib.request.urlopen(base + '/notes') as response:
    original = json.load(response)
    with open(snapshot, 'w') as saved:
        json.dump(original, saved, sort_keys=True)
print('Created two notes to preserve.')
print('Original snapshot: ' + json.dumps(original, sort_keys=True))
PY

echo 'Creating a logical backup and checking the stored object list...'
key=$("${compose[@]}" run --no-deps --rm -T backup backup)
case "$key" in backups/*/*.dump) ;; *) echo "Unexpected backup key: $key" >&2; exit 1 ;; esac
second_key=$("${compose[@]}" run --no-deps --rm -T backup backup)
[[ "$key" != "$second_key" ]] || { echo 'Backup keys were reused.' >&2; exit 1; }
listed=$("${compose[@]}" run --no-deps --rm -T backup list)
if ! grep -Fq "$key" <<<"$listed"; then echo "Backup is absent from object listing: $key" >&2; exit 1; fi
if ! grep -Fq "$second_key" <<<"$listed"; then echo "Second backup is absent from object listing: $second_key" >&2; exit 1; fi
"${compose[@]}" run --no-deps --rm -T --entrypoint python backup -c '
import hashlib, json, os, sys
import boto3
s3 = boto3.client("s3", endpoint_url=os.environ["S3_ENDPOINT_URL"])
bucket, key = os.environ["BACKUP_BUCKET"], sys.argv[1]
assert s3.get_bucket_versioning(Bucket=bucket)["Status"] == "Enabled"
manifest = json.loads(s3.get_object(Bucket=bucket, Key=key[:-5] + ".json")["Body"].read())
data = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
assert manifest["key"] == key and manifest["size_bytes"] == len(data)
assert manifest["sha256"] == hashlib.sha256(data).hexdigest()
print("Backup object, manifest, checksum, and bucket versioning verified.")
print("Verified manifest: " + json.dumps(manifest, sort_keys=True))
' "$key"
echo "Backup stored: $key"

python3 - "$app_url" <<'PY'
import json, sys, urllib.request
base = sys.argv[1]
def request(path, method='GET', body=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {} if data is None else {'Content-Type': 'application/json'}
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as response:
        return response.status, response.read()
status, body = request('/notes')
notes = json.loads(body)
assert len(notes) == 2
request('/notes/' + str(notes[0]['id']), 'PUT', {'title': 'Changed after backup', 'content': 'changed'})
request('/notes/' + str(notes[1]['id']), 'DELETE')
request('/notes', 'POST', {'title': 'New after backup', 'content': 'must disappear'})
print('Changed and deleted data after backup.')
PY

echo 'Stopping writers and simulating database loss...'
"${compose[@]}" stop app backup >/dev/null
postgres_container=$("${compose[@]}" ps -q postgres)
postgres_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$postgres_container")
volume_project=$(docker volume inspect --format '{{index .Labels "com.docker.compose.project"}}' "$postgres_volume")
volume_service=$(docker volume inspect --format '{{index .Labels "com.docker.compose.volume"}}' "$postgres_volume")
if [[ "$volume_project" != "$project" || "$volume_service" != postgres_data ]]; then
  echo 'Refusing to delete a volume that is not this isolated project’s PostgreSQL volume.' >&2
  exit 1
fi
"${compose[@]}" stop postgres >/dev/null
"${compose[@]}" rm --force postgres >/dev/null
docker volume rm "$postgres_volume" >/dev/null
echo 'Deleted the isolated PostgreSQL volume; MinIO backups remain intact.'
"${compose[@]}" up -d postgres >/dev/null
for attempt in $(seq 1 30); do
  if "${compose[@]}" exec -T postgres pg_isready -U notes -d notes >/dev/null 2>&1; then break; fi
  if (( attempt == 30 )); then echo 'Recreated PostgreSQL did not become ready.' >&2; exit 1; fi
  sleep 2
done
fresh_tables=$("${compose[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = '\''public'\'';"')
[[ "$fresh_tables" == 0 ]] || { echo 'Recreated database is not empty.' >&2; exit 1; }
echo 'Verified that the fresh database contains no application tables.'

echo 'Restoring the selected backup after checksum verification...'
"${compose[@]}" run --no-deps --rm backup restore "$key" --yes
"${compose[@]}" up -d app >/dev/null
# Docker can assign a different ephemeral host port when a stopped container starts.
app_url="http://$("${compose[@]}" port app 3000)"
for attempt in $(seq 1 30); do
  if curl -fsS "$app_url/health" >/dev/null; then break; fi
  if (( attempt == 30 )); then echo 'Restored API did not become healthy.' >&2; exit 1; fi
  sleep 2
done
python3 - "$app_url" "$snapshot" <<'PY'
import json, sys, urllib.request
with urllib.request.urlopen(sys.argv[1] + '/notes') as response:
    notes = json.load(response)
with open(sys.argv[2]) as saved:
    original = json.load(saved)
assert notes == original, {'recovered': notes, 'original': original}
print('Disaster recovery passed: the original notes, IDs, and timestamps are back exactly.')
print('Recovered snapshot: ' + json.dumps(notes, sort_keys=True))
PY
