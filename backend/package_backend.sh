#!/usr/bin/env bash
set -euo pipefail

if ! command -v pyinstaller >/dev/null 2>&1; then
  echo "PyInstaller is required. Install with 'pip install pyinstaller'." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUTPUT_DIR="$SCRIPT_DIR/dist"
mkdir -p "$OUTPUT_DIR"

pyinstaller \
  --name backend-service \
  --onefile \
  --clean \
  --distpath "$OUTPUT_DIR" \
  "$SCRIPT_DIR/run_app.py"
