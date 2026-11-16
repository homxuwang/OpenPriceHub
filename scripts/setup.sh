#!/usr/bin/env bash
# Creates private configuration templates only. No login, remote writes or key output.
set -eu
cd -- "$(dirname -- "$0")/.."
exec node scripts/cloudflare.mjs init "$@"
