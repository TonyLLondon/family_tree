#!/bin/bash
# Optional backup babysitter — primary chaining is batch_runner on_complete_fleet.
set -u
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
FLEET="${1:-projects/ingest_source/jobs/tehran-gazette-full-ocr-fleet.yaml}"
PARALLEL="${2:-1}"
INTERVAL="${3:-120}"
PY="${REPO}/.venv/bin/python3"
RUNNER="${REPO}/projects/ingest_source/runner/batch_runner.py"
LOG="${REPO}/projects/ingest_source/history/jobs/fleet-watch.log"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >>"$LOG"; }

cd "$REPO"
log "fleet_watch start fleet=${FLEET} parallel=${PARALLEL} interval=${INTERVAL}s"

while true; do
  "$PY" "$RUNNER" fleet-start --fleet "$FLEET" --parallel "$PARALLEL" --retry-failed >>"$LOG" 2>&1 || true
  status=$("$PY" "$RUNNER" fleet-status --fleet "$FLEET" 2>/dev/null | tail -3)
  if echo "$status" | grep -qE 'Total:.*\(100\.0%\)'; then
    log "fleet complete"
    exit 0
  fi
  log "heartbeat (next poll in ${INTERVAL}s)"
  sleep "$INTERVAL"
done
