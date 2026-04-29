#!/bin/bash
export BASE_URL="${1:-https://sitrep.ultimamilla.com.ar/api}"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)/k6"

echo "=== SITREP STRESS TESTS ==="
echo "Target: $BASE_URL"
echo ""

for SCRIPT in "$SCRIPTS_DIR"/*.js; do
  NAME=$(basename "$SCRIPT")
  echo "--- Running $NAME ---"
  k6 run "$SCRIPT"
  echo ""
done

echo "=== ALL STRESS TESTS COMPLETE ==="
