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
- Validar con Zod en todos los bordes. Las respuestas correctas de preparación y de exámenes **nunca** llegan al cliente.
- Web organizada por funcionalidad (`features/*`). La lógica de negocio no vive en componentes: componentes → hooks → `shared/api` o `packages/domain`.
- Cambios de esquema → actualizar `docs/03-modelo-datos.md` y la migración juntos. Cambios de endpoints → `packages/contracts` y `docs/05-api.md`. Cambios de reglas de puntuación → nueva versión del algoritmo y `docs/02-dominio-y-reglas.md`.
- Secretos nunca en el repo. `.env.example` siempre al día.

## Flujo de diseño de UI (obligatorio para todo lo visual)

1. **Sistema de diseño primero** — skill `ui-ux-pro-max`. Antes de la primera pantalla, genera el sistema de diseño (paleta, tipografía, espaciado, estilo, anti-patrones) partiendo de la identidad existente "pizarra táctica" del prototipo, y guárdalo en `docs/design-system.md` + tokens en `apps/web/src/shared/styles/`. Cada pantalla nueva consulta ese documento; no se inventan colores ni tamaños sueltos.
2. **Dirección estética e implementación** — skill `frontend-design`. Úsala al construir o rediseñar pantallas y componentes de `shared/ui` para evitar el look genérico de plantilla.
3. **Animaciones** — solo donde aporten (transición entre pasos del test, revelado del podio, cambios en la pizarra). Usa la skill de animación instalada; siempre respetando `prefers-reduced-motion`, animando solo `transform`/`opacity` y sin bloquear la interacción.
4. **Auditoría antes de dar por terminada una pantalla** — skills `web-design-guidelines` (accesibilidad, foco, formularios, táctil, dark mode) y `react-best-practices` (re-renders, bundle, data fetching). Corrige los hallazgos críticos y altos; deja los demás anotados en el PR.

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
| `pnpm lint` | ESLint en todo el repo (incluye reglas de frontera entre capas) |
| `pnpm typecheck` | `tsc --noEmit` en cada paquete |
| `pnpm test` | Vitest en cada paquete |
| `pnpm build` | Compila todos los paquetes |
| `pnpm format` | Prettier |
