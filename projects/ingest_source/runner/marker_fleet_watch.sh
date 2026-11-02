#!/usr/bin/env bash
# Run after OCR fleet — one marker PDF at a time (heavy; do not parallel with Surya).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
FLEET="${1:-projects/ingest_source/jobs/tehran-gazette-marker-full-fleet.yaml}"
PY="${REPO}/.venv/bin/python3"
RUNNER="${REPO}/projects/ingest_source/runner/batch_runner.py"

cd "$REPO"
while true; do
  "$PY" "$RUNNER" fleet-start --fleet "$FLEET" --parallel 1 || true
  if "$PY" "$RUNNER" fleet-status --fleet "$FLEET" | grep -qE 'Total:.*\(100\.0%\)'; then
    echo "Marker fleet complete."
    exit 0
  fi
  sleep 300
done
