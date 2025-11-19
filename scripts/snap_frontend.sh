#!/usr/bin/env bash
set -euo pipefail

# Simple snapshot script using headless Chrome.
# Requires Google Chrome or Chromium installed locally.

BASE_URL="${1:-http://127.0.0.1:8787}"
OUT_DIR="${2:-screenshots}"

mkdir -p "$OUT_DIR"

# Resolve Chrome binary
if [[ -n "${CHROME_BIN:-}" ]]; then
  CHROME="$CHROME_BIN"
elif command -v google-chrome >/dev/null 2>&1; then
  CHROME="$(command -v google-chrome)"
elif command -v chromium >/dev/null 2>&1; then
  CHROME="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROME="$(command -v chromium-browser)"
elif [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
else
  echo "Error: Could not find Chrome/Chromium. Set CHROME_BIN to your Chrome executable." >&2
  exit 1
fi

echo "Using Chrome at: $CHROME"
echo "Base URL: $BASE_URL"
echo "Output dir: $OUT_DIR"

# Wait for dev server (best effort, up to 20s)
if command -v curl >/dev/null 2>&1; then
  echo "Checking $BASE_URL availability…"
  for i in $(seq 1 20); do
    if curl -sfI "$BASE_URL/" >/dev/null; then
      echo "Dev server is reachable."
      break
    fi
    if [[ $i -eq 1 ]]; then
      echo "Waiting for dev server to start…" >&2
    fi
    sleep 1
  done
  if ! curl -sfI "$BASE_URL/" >/dev/null; then
    echo "Warning: Can't reach $BASE_URL. Proceeding anyway (screens may show error page)." >&2
  fi
fi

declare -a PAGES=( "/" "/intake" )

# Desktop shots
for PAGE in "${PAGES[@]}"; do
  SAFE_NAME=$(echo "$PAGE" | sed 's#^/##; s#[^a-zA-Z0-9]#_#g')
  [[ -z "$SAFE_NAME" ]] && SAFE_NAME="home"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --window-size=1440,3000 \
    --disable-features=LazyImageLoading,LazyFrameLoading \
    --virtual-time-budget=5000 \
    --screenshot="$OUT_DIR/desktop_${SAFE_NAME}.png" \
    "${BASE_URL}${PAGE}"
  echo "Saved: $OUT_DIR/desktop_${SAFE_NAME}.png"
done



echo "Snapshots complete. Files in: $OUT_DIR"
