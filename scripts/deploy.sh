#!/usr/bin/env bash
# All configuration is read by Node; never source secret files or enable shell tracing.
set -eu
cd -- "$(dirname -- "$0")/.."
exec node scripts/cloudflare.mjs deploy "$@"
