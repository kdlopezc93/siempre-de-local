# Siempre de Local

La mano derecha de los equipos y técnicos de fútbol amateur, donde el fútbol es más pasión que profesión. PWA para orientar a jugadores sobre su posición ideal, con panel del entrenador, examen de conocimiento por posición, tarjeta 0–99 y planificador de alineaciones. Promesa: tu equipo, siempre de local.

Tono de la UI: cercano, de barrio y en español latinoamericano; nada de jerga corporativa ni de "club profesional".

**Antes de cualquier tarea, lee `docs/00-contexto-proyecto.md`.** Las decisiones de arquitectura están en `docs/01-arquitectura.md` (ADR-01 a ADR-08) y el plan en `docs/06-roadmap.md`. Si una tarea contradice un ADR, para y pregunta; si se decide cambiarlo, actualiza el ADR en la misma tarea.

## Stack (no cambiar sin actualizar el ADR)

- Monorepo **pnpm**: `apps/web` (React + Vite, PWA), `apps/api` (NestJS + adaptador Fastify), `packages/domain` (TS puro), `packages/contracts` (Zod), `packages/config`.
- PostgreSQL + **Drizzle**. Auth: **Better Auth + Google OAuth**, cookie httpOnly, `app.` y `api.` en el mismo dominio.
- REST + contratos Zod. Nada de GraphQL, Next.js ni JWT en `localStorage`.

## Reglas de código

- `packages/domain` no importa NestJS, Drizzle, React ni nada de I/O.
- API: `http → application → domain`; `application` define puertos, `infrastructure` los implementa. Solo `identity/infrastructure` importa Better Auth.
- La autorización se decide en `application`; el guard en `http` es la primera barrera, no la única.
- Validar con Zod en todos los bordes. Las respuestas correctas de los exámenes **nunca** llegan al cliente.
- Web organizada por funcionalidad (`features/*`). La lógica de negocio no vive en componentes: componentes → hooks → `shared/api` o `packages/domain`.
- Cambios de esquema → actualizar `docs/03-modelo-datos.md` y la migración juntos. Cambios de endpoints → `packages/contracts` y `docs/05-api.md`. Cambios de reglas de puntuación → nueva versión del algoritmo y `docs/02-dominio-y-reglas.md`.
- Secretos nunca en el repo. `.env.example` siempre al día.

## Flujo de diseño de UI (obligatorio para todo lo visual)

1. **Sistema de diseño primero** — skill `ui-ux-pro-max`. Antes de la primera pantalla, genera el sistema de diseño (paleta, tipografía, espaciado, estilo, anti-patrones) partiendo de la identidad existente "pizarra táctica" del prototipo, y guárdalo en `docs/design-system.md` + tokens en `apps/web/src/shared/styles/`. Cada pantalla nueva consulta ese documento; no se inventan colores ni tamaños sueltos.
2. **Dirección estética e implementación** — skill `frontend-design`. Úsala al construir o rediseñar pantallas y componentes de `shared/ui` para evitar el look genérico de plantilla.
3. **Animaciones** — solo donde aporten (transición entre pasos del test, revelado del podio, cambios en la pizarra). Usa la skill de animación instalada; siempre respetando `prefers-reduced-motion`, animando solo `transform`/`opacity` y sin bloquear la interacción.
4. **Auditoría antes de dar por terminada una pantalla** — skills `web-design-guidelines` (accesibilidad, foco, formularios, táctil, dark mode) y `vercel-react-best-practices` (re-renders, bundle, data fetching). Corrige los hallazgos críticos y altos; deja los demás anotados en el PR.

Mobile first: la mayoría de jugadores lo usará en el celular. Objetivos táctiles ≥ 44 px, sin scroll horizontal, probado a 360 px de ancho.

## Definición de terminado

- `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- Tests de dominio para cualquier cambio en puntuación (incluidos los de paridad con el prototipo).
- Si toca UI: pasó la auditoría del paso 4 del flujo de diseño.
- Docs actualizadas según las reglas de arriba.
- Commits en convencional (`feat:`, `fix:`, `chore:`…) y PR pequeño por tarea.

## Comandos

Requisitos: Node 24 (`nvm use`, ver `.nvmrc`) y pnpm vía `corepack enable`.

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala el workspace |
| `pnpm dev` | Levanta API (`:3000`, prefijo `/api/v1`) y web (`:5173`); se usan vía Caddy en `https://app.sdl.localtest.me` |
| `pnpm --filter @sdl/web icons` | Regenera los iconos de la PWA desde `apps/web/public/favicon.svg` |
| `pnpm lint` | ESLint en todo el repo (incluye reglas de frontera entre capas) |
| `pnpm typecheck` | `tsc --noEmit` en cada paquete |
| `pnpm test` | Vitest en cada paquete |
| `pnpm e2e` | Playwright: invitar → unirse → test → resultado en Chromium, con su propia base `sdl_e2e` y puertos 3100/4273 (`e2e/`). Requiere `pnpm db:up`; la primera vez, `pnpm --filter @sdl/e2e exec playwright install --with-deps chromium` (pide sudo) |
| `pnpm build` | Compila todos los paquetes |
| `pnpm format` | Prettier |
| `pnpm admin:seed-demo -- --team-id <uuid>` | Llena un equipo con 14 jugadores de demostración (tests y valoraciones de un asistente demo); idempotente, nunca en producción |
| `pnpm bank:lint [-- --md <carpeta>]` | Control de calidad de los bancos del examen de conocimiento; con `--md` escribe la hoja de revisión de cada banco para el entrenador revisor |
| `pnpm db:up` | Levanta Postgres 18 local (`docker compose up -d --wait db`) |
| `pnpm db:generate` | Genera la migración SQL a partir del esquema Drizzle |
| `pnpm db:migrate` | Aplica las migraciones pendientes |
| `pnpm db:check` | Comprueba la consistencia de las migraciones |
| `pnpm db:seed` | Compila el API y publica el contenido inicial (cuestionarios y bancos del examen **revisados**); idempotente. Con `-- --drafts` publica además los bancos sin revisar como `v1-borrador`, **solo en desarrollo** |
| `pnpm admin:bootstrap-team -- --club-name … --club-slug … --team-name … --format F11 --season 2026 --owner-email … --coach-email …` | Alta de club con su dueño y un equipo con su entrenador (deben haber entrado una vez con Google); idempotente |
| `pnpm proxy:up` | Levanta Caddy (HTTPS local en `app.`/`api.sdl.localtest.me`) |
| `pnpm dev:tunnel <url-túnel>` | Desarrollo desde el celular: app (con recarga en vivo) y API (en vigilancia) por el túnel de VS Code al puerto 4173. Reemplaza a `pnpm dev` mientras corre. **No tiene service worker:** lo que es sin conexión (abrir sin señal, cola, podio provisional) se prueba con `preview:tunnel`. Al cambiar de un modo al otro, cierra todas las pestañas de la app y la app instalada en el celular (el service worker anterior manda hasta que no quede ninguna abierta) |
| `pnpm preview:tunnel <url-túnel>` | Build real (con service worker) + API por el mismo túnel: instalación y todo lo que es sin conexión en el celular |
| `pnpm proxy:cert` | Exporta el certificado raíz de Caddy a `.certs/` para importarlo en Windows |

Los tests de integración del API levantan su propio Postgres con Testcontainers (requieren Docker).
**CI** (`.github/workflows/ci.yml`, en cada PR y en `main`): formato, lint, typecheck, tests y build; y migraciones en seco (`db:check`, esquema ↔ migraciones sincronizados, `db:migrate` dos veces sobre una BD vacía y `db:seed` dos veces). Si cambias el esquema, sube la migración generada o la CI falla.
Cada app tiene su `.env.example`; cópialo a `.env` en la misma carpeta.
**Staging** (Fly.io + Cloudflare Pages + Neon): `docs/deploy.md`. La imagen del API se construye con `docker build -f apps/api/Dockerfile .` (la CI lo comprueba en cada PR); las migraciones en producción las corre `node dist/scripts/migrate.js` (sin drizzle-kit).
En WSL con el repo bajo `/mnt/c`, Vite y `tsc --watch` sondean archivos (no hay eventos inotify); mover el repo al disco de Linux (`~/`) acelera todo.
