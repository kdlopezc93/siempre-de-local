#!/usr/bin/env bash
# Desarrollo con el celular: app (Vite en modo dev, con recarga en vivo) y API (en modo
# vigilancia) por un solo origen HTTPS, el túnel de VS Code al puerto 4173.
#
#   pnpm dev:tunnel https://<id>-4173.<region>.devtunnels.ms
#
# Reemplaza a `pnpm dev` mientras corre (usa el puerto 3000 del API). Sin service worker:
# para probar instalación y modo sin conexión, `pnpm spike:pwa` (build real).
set -euo pipefail

TUNNEL_URL="${1:-}"
if [[ ! "$TUNNEL_URL" =~ ^https://[^/]+$ ]]; then
  echo "Uso: pnpm dev:tunnel https://<id>-4173.<region>.devtunnels.ms (sin / final)" >&2
  exit 1
fi

# Las variables exportadas ganan a los .env (node --env-file y Vite no las pisan):
# la cookie se emite para el host del túnel y la app llama al API en su mismo origen.
export BETTER_AUTH_URL="$TUNNEL_URL" WEB_ORIGIN="$TUNNEL_URL" COOKIE_DOMAIN="${TUNNEL_URL#https://}"
export VITE_API_URL="$TUNNEL_URL" SDL_TUNNEL_ORIGIN="$TUNNEL_URL"

pnpm --filter "@sdl/api^..." build
echo
echo "Abre $TUNNEL_URL en el celular: los cambios se ven solos (Ctrl+C para parar)."
pnpm --parallel --filter ./apps/api --filter ./apps/web dev
