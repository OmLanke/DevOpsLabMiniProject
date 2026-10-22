# Five-minute local demo and speaking script

Target: **5 minutes**. Allow up to 2 extra minutes for questions or slower container startup.

## Before presenting

Run commands from the project folder. Docker must be running. This machine's normal stack was already healthy when this guide was prepared.

```sh
docker compose up -d --wait
docker compose ps
curl -fsS http://localhost:3000/health
```

Expected health response: `{"status":"ok","database":"connected"}`.

For a fresh checkout, first run `cp .env.example .env` (only if `.env` does not exist), then `docker compose up -d --build --wait`. Finish the first build **before** presenting: MinIO compiles from source and an uncached build can take several minutes. The demo also needs host Python 3 and curl.

Keep these ready:

- A terminal in this project folder, with readable font size.
- This script on a second screen or beside the terminal.
- Optional: MinIO at <http://localhost:9001>. Log in beforehand using the MinIO credentials in `.env`; open `notes-backups`. Keep credentials off the projector.
- Optional: `.github/workflows/ci.yml` and `.github/workflows/backup.yml` in your editor.

## 0:00–0:45 — Introduction

**Say:**

“Good morning. Our mini project is Automated Database Backup, Versioned Storage, and Disaster Recovery for a Dockerized Web Application.

“Applications can lose data through accidental deletion, failed changes, or damaged storage. Restarting an application does not recover lost database data. We need a separate backup and a tested way to restore it.

“Our project automates PostgreSQL backups, stores multiple recovery points in S3-compatible storage, and demonstrates recovery after the database volume is deleted. The focus is on proving that the data actually comes back.”

## 0:45–1:20 — Explain the architecture

**Run:**

```sh
docker compose ps
curl -fsS http://localhost:3000/health
```

**Say:**

“There are four services managed by Docker Compose. An Express Notes API stores records in PostgreSQL. A Python worker uses pg_dump to create compressed logical backups and uploads them to MinIO, our local S3-compatible storage.

“Each backup has a unique timestamped name and a JSON manifest containing its size and SHA-256 checksum. Bucket versioning is also enabled. The worker backs up immediately on startup, then waits five minutes after each attempt.”

## 1:20–3:40 — Run the recovery demonstration

**Run once:**

```sh
./scripts/demo.sh 2>&1 | tee /tmp/devops-demo-live.log
```

**Say while containers start:**

“This command runs our existing automated demonstration in an isolated Docker Compose project. It uses temporary ports and volumes, so our normal running stack stays separate. It cleans up its own resources afterward.”

**Narrate the milestones as they appear; do not read the build output:**

| Output to point to | What to say |
| --- | --- |
| `Created two notes to preserve.` / `Original snapshot:` | “We create two notes and save all their original fields for comparison.” |
| `Backup object, manifest, checksum, and bucket versioning verified.` | “We create two distinct recovery points and check that the stored dump matches its manifest, byte size, and checksum.” |
| `Changed and deleted data after backup.` | “We update one note, delete another, and add a new note after the backup.” |
| `Deleted the isolated PostgreSQL volume; MinIO backups remain intact.` | “We stop application writers and delete only the temporary project's database volume. Backup storage survives separately.” |
| `Verified that the fresh database contains no application tables.` | “This confirms the old database is gone. We are recovering into an empty database.” |
| `Disaster recovery passed: the original notes, IDs, and timestamps are back exactly.` | “The selected backup has restored the complete original records. The script compares every returned field with the saved snapshot, including IDs and timestamps.” |

**When it finishes, highlight the result again:**

```sh
grep -E 'Original snapshot:|Verified manifest:|Deleted the isolated|fresh database|Disaster recovery passed:|Recovered snapshot:' /tmp/devops-demo-live.log
```

If the command finishes early, use the remaining time to compare the original and recovered snapshots. The printed success assertion is the evidence; the grep command only highlights it.

## 3:40–4:25 — Automation and stored backups

**Run:**

```sh
./scripts/list-backups.sh
```

**Say:**

“These are backups in the normal local stack. The temporary demo's backups are removed during its cleanup. In MinIO we can inspect the dump objects and their companion JSON manifests.

“GitHub Actions is configured to run application tests and a complete recovery exercise on pushes and pull requests. A separate workflow runs the exercise daily in a disposable environment and saves the recovery log as an artifact. That scheduled workflow demonstrates automation; it does not back up this laptop's database.”

Optionally show the already-open MinIO bucket or workflow files. Do not wait five minutes for a scheduled worker backup during the presentation. Do not claim a remote workflow passed unless you have its actual result.

## 4:25–5:00 — Conclusion and limitations

**Say:**

“The main result is verified recovery after database-volume loss. Docker Compose makes the environment reproducible, the worker automates snapshots, MinIO keeps recovery points, and checksum verification detects accidental backup corruption before import. Restore runs in a single database transaction and stops on errors.

“This is a local teaching system. PostgreSQL and MinIO share the same machine, so losing the host could lose both. Production would require off-host backups and stronger access controls. Changes made after the selected backup are not recovered.

“Our takeaway is that a backup is useful only when restoration has been tested. This demo tests that full path. Thank you.”

## Quick answers if asked

- **Why Docker?** Reproducible services, health checks, networking, and persistent volumes.
- **Why MinIO?** It provides an S3-compatible object-storage API locally.
- **Unique keys versus versioning?** Unique keys preserve separate recovery points; bucket versioning preserves earlier versions if an object key is overwritten.
- **What does SHA-256 prove?** The downloaded bytes match the recorded checksum. It detects accidental corruption, but is not proof against someone who can replace both dump and manifest.
- **How much data can be lost?** Everything after the selected snapshot. The normal interval is five minutes plus backup duration, and failures can make the latest successful snapshot older.
- **Does restore merge old and new data?** No. It replaces database objects with the selected snapshot; later changes are lost.
- **How long does recovery take?** It depends on data size and startup/import time. Quote the observed demo time, not a production guarantee.

## If something fails

Do not reset the regular stack or run `docker compose down -v`: that deletes its database and backups. Read the last error in `/tmp/devops-demo-live.log`. The isolated demo cleans up on exit and can be rerun after resolving the error.

If live recovery cannot finish within your slot, show the previously recorded `report/evidence/recovery-run.log` and explicitly describe it as a recorded run. Keep the intro, architecture, and limitation explanation; skip optional UI browsing.

To stop the normal stack after presenting while keeping its data:

```sh
docker compose down
```
