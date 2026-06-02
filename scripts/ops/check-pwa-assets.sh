#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-${TARGET_URL:-https://sitrep.ultimamilla.com.ar}}"
TARGET_URL="${TARGET_URL%/}"
TIMEOUT="${TIMEOUT:-20}"

FAIL=0
TMP_DIR="$(mktemp -d)"
APP_HTML="$TMP_DIR/app.html"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pass() {
  echo "PASS $1"
}

fail() {
  echo "FAIL $1" >&2
  FAIL=$((FAIL + 1))
}

curl_status_to_file() {
  local path="$1"
  local outfile="$2"
  : > "$outfile"
  curl -L -sS --max-time "$TIMEOUT" -o "$outfile" -w '%{http_code}' "$TARGET_URL$path" 2>/dev/null || true
}

curl_status_and_type() {
  local path="$1"
  curl -L -sS --max-time "$TIMEOUT" -o /dev/null -w '%{http_code} %{content_type}' "$TARGET_URL$path" 2>/dev/null || true
}

echo "SITREP PWA asset check"
echo "Target: $TARGET_URL"

app_status="$(curl_status_to_file "/app/" "$APP_HTML")"
if [[ "$app_status" == "200" ]]; then
  pass "/app/ app.html shell returns 200"
else
  fail "/app/ app.html shell returned HTTP $app_status"
fi

if grep -Eiq '<script[^>]+src=["'\''](/app/)?assets/[^"'\'']+\.js' "$APP_HTML"; then
  pass "/app/ references versioned JavaScript assets"
else
  fail "/app/ does not reference versioned JavaScript assets"
fi

assets="$(
  grep -Eo '["'\''](/app/)?assets/[^"'\'']+\.(js|css)' "$APP_HTML" \
    | sed -E 's/^["'\'']//; s#^assets/#/app/assets/#; s#^/app/assets/#/app/assets/#' \
    | sort -u || true
)"

if [[ -z "$assets" ]]; then
  fail "No /app/assets/ JS/CSS references found in app.html"
else
  while IFS= read -r asset_path; do
    [[ -z "$asset_path" ]] && continue

    result="$(curl_status_and_type "$asset_path")"
    status="${result%% *}"
    content_type="${result#* }"

    if [[ "$status" != "200" ]]; then
      fail "$asset_path returned HTTP $status"
      continue
    fi

    case "$asset_path" in
      *.js)
        if [[ "$content_type" == application/javascript* || "$content_type" == text/javascript* ]]; then
          pass "$asset_path returns JavaScript ($content_type)"
        else
          fail "$asset_path returned non-JS Content-Type: $content_type"
        fi
        ;;
      *.css)
        if [[ "$content_type" == text/css* ]]; then
          pass "$asset_path returns CSS ($content_type)"
        else
          fail "$asset_path returned non-CSS Content-Type: $content_type"
        fi
        ;;
    esac
  done <<< "$assets"
fi

missing_asset="/app/assets/__missing_postdeploy_check_$(date +%s).js"
missing_result="$(curl_status_and_type "$missing_asset")"
missing_status="${missing_result%% *}"

# Required invariant: missing PWA assets must return = 404, never app.html.
if [[ "$missing_status" == "404" ]]; then
  pass "missing /app/assets/*.js returns 404"
else
  fail "missing /app/assets/*.js returned HTTP $missing_status instead of 404"
fi

if [[ "$FAIL" -gt 0 ]]; then
  echo "RESULT: FAIL ($FAIL)" >&2
  exit 1
fi

echo "RESULT: PASS"
