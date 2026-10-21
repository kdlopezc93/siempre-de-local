#!/usr/bin/env bash
# Build real (con service worker) y API por un solo origen HTTPS, el túnel de VS Code al
# puerto 4173: para probar en el celular la instalación y todo lo que es sin conexión.
# Para ver cambios en vivo, `pnpm dev:tunnel` (sin service worker).
#
#   pnpm preview:tunnel https://<id>-4173.<region>.devtunnels.ms
set -euo pipefail

TUNNEL_URL="${1:-}"
if [[ ! "$TUNNEL_URL" =~ ^https://[^/]+$ ]]; then
  echo "Uso: pnpm preview:tunnel https://<id>-4173.<region>.devtunnels.ms (sin / final)" >&2
  exit 1
fi
TUNNEL_HOST="${TUNNEL_URL#https://}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# El API se compila igual que en `pnpm dev`; antes sus paquetes (contracts, domain), cuyo dist importa.
pnpm --filter "@sdl/api^..." build
pnpm --filter @sdl/api exec tsc -p tsconfig.build.json
VITE_API_URL="$TUNNEL_URL" pnpm --filter @sdl/web exec vite build --mode tunnel

# Las variables exportadas ganan a apps/api/.env (node --env-file no las pisa):
# app y API comparten el origen del túnel, y la cookie se emite para ese host.
cd "$ROOT/apps/api"
BETTER_AUTH_URL="$TUNNEL_URL" WEB_ORIGIN="$TUNNEL_URL" COOKIE_DOMAIN="$TUNNEL_HOST" \
  node --env-file-if-exists=.env dist/main.js &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

cd "$ROOT/apps/web"
echo
echo "Abre $TUNNEL_URL en el celular (Ctrl+C para parar)."
SDL_TUNNEL_ORIGIN="$TUNNEL_URL" pnpm exec vite preview --mode tunnel
