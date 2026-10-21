# Siempre de Local

La mano derecha de los equipos y técnicos de fútbol amateur, donde el fútbol es más pasión que profesión. **Tu equipo, siempre de local.**

PWA (React + Vite) + API (NestJS + Fastify) + PostgreSQL, en un monorepo pnpm. La documentación del proyecto está en [`docs/`](docs/); empieza por [`docs/00-contexto-proyecto.md`](docs/00-contexto-proyecto.md).

## Puesta en marcha local

Requisitos: Node 24 (`nvm use`), pnpm vía `corepack enable`, Docker y Chrome o Edge.

```bash
pnpm install
pnpm db:up            # Postgres 18
pnpm db:migrate
pnpm proxy:up         # Caddy: HTTPS en app.sdl.localtest.me y api.sdl.localtest.me
cp apps/api/.env.example apps/api/.env   # y rellena los valores
cp apps/web/.env.example apps/web/.env
pnpm dev              # abre https://app.sdl.localtest.me
```

### HTTPS local (una sola vez)

En local, la app y el API viven en `https://app.sdl.localtest.me` y `https://api.sdl.localtest.me`, para que la cookie de sesión se comparta entre subdominios igual que en producción (ver `docs/04-auth-seguridad.md` §1.0). `*.localtest.me` resuelve siempre a tu propia máquina.

Caddy firma esos certificados con una autoridad local. Para que el navegador confíe en ella:

1. `pnpm proxy:cert` → crea `.certs/caddy-local-root.crt` (no se sube al repo).
2. En Windows (desde WSL): `certutil.exe -user -addstore Root "$(wslpath -w .certs/caddy-local-root.crt)"` y acepta el aviso. Así queda instalado solo para tu usuario.
3. Reinicia el navegador.

Si tu router bloquea el DNS de `localtest.me`, añade al archivo `hosts` de Windows: `127.0.0.1 app.sdl.localtest.me` y `127.0.0.1 api.sdl.localtest.me`.

### Google OAuth

En Google Cloud Console → _Google Auth Platform_ → _Clientes_, crea un cliente de tipo **Aplicación web** con:

- Origen de JavaScript: `https://app.sdl.localtest.me`
- URI de redirección: `https://api.sdl.localtest.me/api/auth/callback/google`

Copia el Client ID y el secret en `apps/api/.env`. Mientras la app esté en modo _Testing_, solo pueden entrar las cuentas añadidas como _usuarios de prueba_.

## Comandos

Ver la sección _Comandos_ de [`docs/CLAUDE.md`](docs/CLAUDE.md).
