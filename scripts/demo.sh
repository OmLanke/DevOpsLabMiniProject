#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
echo 'Running the isolated disaster-recovery demonstration. Its temporary Compose volumes are removed on exit.'
exec "$SCRIPT_DIR/integration.sh"
