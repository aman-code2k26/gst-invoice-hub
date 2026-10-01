#!/usr/bin/env bash
# Starts the demo backend + Cloudflare tunnel, then points the GitHub Pages
# frontend at the new tunnel URL and redeploys it.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
API_PORT="${API_PORT:-4000}"
PAGES_ORIGIN="https://aman-code2k26.github.io"
LOG_DIR="/tmp/gst-invoice-hub-demo"
mkdir -p "$LOG_DIR"

export GIT_AUTHOR_NAME="aman-code2k26"
export GIT_AUTHOR_EMAIL="274073220+aman-code2k26@users.noreply.github.com"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

# locate node/npx (may live in nvm/homebrew/opencode tooling, not on default PATH)
if ! command -v npx >/dev/null 2>&1; then
  for cand in "$HOME"/.nvm/versions/node/*/bin /opt/homebrew/bin /usr/local/bin /private/var/folders/*/*/T/opencode/tools/node/bin; do
    if [ -x "$cand/npm" ]; then export PATH="$cand:$PATH"; break; fi
  done
fi
command -v npx >/dev/null 2>&1 || { echo "npx not found — install Node.js 20+ first"; exit 1; }

# 1. cloudflared binary
if [ ! -x /tmp/cloudflared ]; then
  echo "Downloading cloudflared..."
  curl -sL -o /tmp/cloudflared.tgz \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
  tar xzf /tmp/cloudflared.tgz -C /tmp cloudflared
  chmod +x /tmp/cloudflared
fi

# 2. backend API
if ! curl -s -m 3 "http://localhost:$API_PORT/api/health" | grep -q '"ok"'; then
  echo "Starting backend on port $API_PORT..."
  ( trap '' TERM INT HUP
    cd "$ROOT/backend"
    FRONTEND_URL="$PAGES_ORIGIN" PORT="$API_PORT" exec npx tsx src/server.ts \
      > "$LOG_DIR/api.log" 2>&1 ) &
  disown
  for _ in $(seq 1 20); do
    curl -s -m 2 "http://localhost:$API_PORT/api/health" | grep -q '"ok"' && break
    sleep 1
  done
fi
curl -s -m 3 "http://localhost:$API_PORT/api/health" >/dev/null || {
  echo "Backend failed to start — see $LOG_DIR/api.log"; exit 1; }
echo "Backend OK on :$API_PORT"

# 3. tunnel
TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1 || true)"
if [ -z "$TUNNEL_URL" ] || ! curl -s -m 5 "$TUNNEL_URL/api/health" | grep -q '"ok"'; then
  echo "Starting Cloudflare tunnel..."
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  sleep 1
  ( trap '' TERM INT HUP
    exec /tmp/cloudflared tunnel --url "http://localhost:$API_PORT" --no-autoupdate \
      > "$LOG_DIR/tunnel.log" 2>&1 ) &
  disown
  TUNNEL_URL=""
  for _ in $(seq 1 30); do
    TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | tail -1 || true)"
    [ -n "$TUNNEL_URL" ] && curl -s -m 5 "$TUNNEL_URL/api/health" | grep -q '"ok"' && break
    sleep 2
  done
fi
[ -n "$TUNNEL_URL" ] || { echo "Tunnel failed — see $LOG_DIR/tunnel.log"; exit 1; }
echo "Tunnel OK: $TUNNEL_URL"
echo "$TUNNEL_URL" > "$LOG_DIR/tunnel-url.txt"

# 4. repoint the live frontend at this tunnel URL
WORKFLOW="$ROOT/.github/workflows/deploy-pages.yml"
sed -i '' "s|NEXT_PUBLIC_API_URL: .*|NEXT_PUBLIC_API_URL: $TUNNEL_URL/api|" "$WORKFLOW"

if ! git diff --quiet "$WORKFLOW"; then
  echo "Deploying updated frontend (API URL changed)..."
  git add "$WORKFLOW"
  git commit -q -m "Demo: point live frontend at $TUNNEL_URL"
  git push -q origin main
  echo "Frontend redeploys in ~1-2 min: https://aman-code2k26.github.io/gst-invoice-hub/"
else
  echo "Frontend already points at this tunnel — no redeploy needed."
fi

echo
echo "API health (public): $TUNNEL_URL/api/health"
echo "Site for judges:     https://aman-code2k26.github.io/gst-invoice-hub/"
