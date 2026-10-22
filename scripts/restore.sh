#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo "Usage: $0 <backup-object-key> [--yes]" >&2
    exit 2
fi
key=$1
confirm=${2:-}
if [ -n "$confirm" ] && [ "$confirm" != "--yes" ]; then
    echo "Usage: $0 <backup-object-key> [--yes]" >&2
    exit 2
fi

if ! printf '%s\n' "$key" | grep -Eq '^backups/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{32}\.dump$'; then
    echo "Invalid backup object key" >&2
    exit 2
fi

if [ "$confirm" != "--yes" ]; then
    printf "WARNING: this replaces database objects using %s. Type 'restore' to continue: " "$key" >&2
    IFS= read -r answer || answer=
    if [ "$answer" != "restore" ]; then
        echo "Restore cancelled." >&2
        exit 1
    fi
fi

running=$(docker compose ps --status running --services)
was_app=false
was_backup=false
if printf '%s\n' "$running" | grep -qx app; then was_app=true; fi
if printf '%s\n' "$running" | grep -qx backup; then was_backup=true; fi

restore_running_services() {
    status=$?
    trap - EXIT HUP INT TERM
    if [ "$was_app" = true ]; then docker compose start app || status=1; fi
    if [ "$was_backup" = true ]; then docker compose start backup || status=1; fi
    exit "$status"
}
trap restore_running_services EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

docker compose stop app backup
docker compose run --rm --no-deps backup restore "$key" --yes
