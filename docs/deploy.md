# Despliegue de staging (D5)

> Decisión D5 (`06-roadmap.md`): **Cloudflare** (dominio, DNS y la PWA en Pages) + **Fly.io** (API en `iad`, Virginia) + **Neon** (Postgres en `us-east-1`). Los usuarios están en Colombia; el este de EE. UU. es la región más cercana en los tres. Staging cuesta ≈ US$0–4/mes más el dominio.
>
> Lo que ya está en el repo: `apps/api/Dockerfile` (+ `.dockerignore`), `fly.toml`, `apps/web/public/_headers`, el job de CI que construye la imagen y `.github/workflows/deploy-staging.yml` (manual). Falta lo que necesita cuentas y el dominio: los pasos de abajo.

En los ejemplos, el dominio es `siempredelocal.app`; cámbialo por el que se compre.

## 1. Dominio (Cloudflare)

1. Comprar el dominio en Cloudflare Registrar (a precio mayorista).
2. Queda con DNS en Cloudflare. No hace falta nada más aquí todavía.

## 2. Base de datos (Neon)

1. Crear el proyecto `siempre-de-local` en la región **AWS us-east-1**.
2. Crear la base `sdl` y copiar dos cadenas de conexión:
   - **Directa** (sin `-pooler`): para las migraciones.
   - **Con pooler** (`-pooler` en el host): para el API.
   Ambas con `?sslmode=require`.
3. Plan gratis: se duerme a los 5 min sin uso y tarda ~1 s en despertar. Para staging está bien.

## 3. API (Fly.io)

Requiere `flyctl` y una cuenta con tarjeta (cobra por segundo encendido).

```bash
fly auth login
fly apps create sdl-api-staging          # si el nombre está tomado, cámbialo también en fly.toml
fly secrets set --app sdl-api-staging \
  DATABASE_URL='postgres://…-pooler…/sdl?sslmode=require' \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  GOOGLE_CLIENT_ID='…' GOOGLE_CLIENT_SECRET='…'
```

`release_command` (en `fly.toml`) migra y siembra antes de cada versión con la misma `DATABASE_URL`. Si el pooler de Neon diera problemas con las migraciones, usar la cadena directa.

Los despliegues son **blue-green** (`strategy` en `fly.toml`): Fly prende la máquina nueva, espera su health check (`/api/v1/health`) y solo entonces apaga la vieja, así que no hay corte. Si la nueva no pasa el chequeo, la vieja sigue atendiendo. Por eso una migración tiene que ser compatible con la versión anterior del API mientras dura el cambio (agregar antes de quitar).

## 4. Variables públicas del API

En `fly.toml`, descomentar y completar `[env]`:

```toml
BETTER_AUTH_URL = "https://api.siempredelocal.app"
WEB_ORIGIN = "https://app.siempredelocal.app"
COOKIE_DOMAIN = "siempredelocal.app"
```

## 5. Primer despliegue del API y dominio `api.`

```bash
fly deploy                                     # desde la raíz del repo
fly certs add api.siempredelocal.app --app sdl-api-staging
```

Fly muestra los registros DNS a crear: en Cloudflare, un `CNAME api → sdl-api-staging.fly.dev` en **modo solo DNS** (nube gris), para que el certificado lo emita Fly. Comprobar:

```bash
curl https://api.siempredelocal.app/api/v1/health   # {"status":"ok","checks":{"database":"up"}}
```

## 6. PWA (Cloudflare Pages) y dominio `app.`

Crear un proyecto de Pages conectado al repo de GitHub:

| Ajuste | Valor |
|---|---|
| Rama de producción | `main` |
| Comando de build | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @sdl/web build` |
| Directorio de salida | `apps/web/dist` |
| Variables | `VITE_API_URL=https://api.siempredelocal.app` · `NODE_VERSION=24.22.0` |

Luego **Dominios personalizados → `app.siempredelocal.app`** (Cloudflare crea el DNS solo). Pages sirve la SPA y aplica `apps/web/public/_headers`.

## 7. Google

En Google Cloud Console → Google Auth Platform:

1. **Clientes → cliente web:** origen `https://app.siempredelocal.app` y redirección `https://api.siempredelocal.app/api/auth/callback/google`.
2. **Público → Publicar la app ("En producción")**: con solo `openid email profile` no exige verificación. Así entra cualquiera con invitación, sin agregarlo como usuario de prueba.

## 8. Datos iniciales y prueba

```bash
fly ssh console --app sdl-api-staging -C "node dist/scripts/bootstrap-team.js --club-name '…' --club-slug … --team-name '…' --format F11 --season 2026 --owner-email … --coach-email …"
```

(El dueño y el entrenador entran una vez con Google antes.) Después:

- Entrar como entrenador, crear una invitación y abrirla **con un segundo usuario** (prueba pendiente desde la Fase 0).
- Repetir la prueba sin conexión en Android y **en iPhone** (`docs/spikes/pwa.md`).
- Despliegue automático: `deploy-staging.yml` despliega el API cada vez que la CI de `main` pasa, con el secreto `FLY_API_TOKEN` de GitHub, un token de despliegue limitado a la app: `fly tokens create deploy --app sdl-api-staging --expiry 8760h | gh secret set FLY_API_TOKEN`. **Vence al año:** renovarlo igual antes de que falle el despliegue.

## 9. Pendiente al tener el dominio

- **Avisos (Web Push):** generar llaves VAPID para staging (`npx web-push generate-vapid-keys`) y cargarlas como secretos en Fly (`fly secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=https://app.siempredelocal.app`). Sin ellas, los avisos quedan apagados.

- **CSP:** ya la pone el build en `_headers` con el `VITE_API_URL` de staging (`04` §6.3). Basta con construir con `VITE_API_URL=https://api.siempredelocal.app` y verificar el login con Google y el service worker.
- **HSTS** en el dominio (Cloudflare → SSL/TLS → Edge Certificates).
- **Backups:** Neon guarda historial para restaurar (6 h en el plan gratis); para producción, plan con más días y una prueba de restauración (`04` §4).
- **Política de datos (D7):** publicada el 2026-10-30 sin revisión legal; la página pública es `https://app.siempredelocal.app/tus-datos` (la que va en Google Auth Platform como política de privacidad). Falta la revisión de un abogado.
