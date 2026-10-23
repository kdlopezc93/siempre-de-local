# 05 · Contrato de la API (REST v1)

> Base: `https://api.<dominio>`. JSON. Autenticación por cookie de sesión. Los esquemas exactos viven en `packages/contracts` (Zod); este documento es el índice legible. Si discrepan, **manda el código de contracts**. Por qué REST y no GraphQL: ADR-08.

---

## Convenciones

- Prefijo `/api/v1`. Identidad en `/api/auth/*` (Better Auth: login con Google, sesión, logout; no se documenta aquí).
- Errores: `{ "error": { "code": "TEAM_NOT_FOUND", "message": "...", "details"?: {} } }` · 400 validación, 401 sin sesión, 403 sin permiso, 404, 409 conflicto, 422 regla de negocio, 429 límite.
- Paginación por cursor: `?cursor=<id>&limit=20` → `{ items, nextCursor }`.
- Fechas ISO 8601 UTC.
- Idempotencia en envíos offline mediante `clientAttemptId`.

## Operación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Público. `{ status: 'ok' \| 'degraded', checks: { database: 'up' \| 'down' } }`; 503 si una dependencia está caída |

## Yo

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | `{ user, profile, consent: { policyVersion, acceptedAt } \| null, teams: [{ team, club, roles }], clubs: [{ id, name, role }] }` (`MeResponseSchema`). `consent` es null si no aceptó la versión vigente; `profile` trae valores por defecto si nunca se editó |
| POST | `/me/consent` | Aceptar la política vigente: `{ policyVersion, ageConfirmed: true }` → 201 `{ consent }`, idempotente. 400 sin `ageConfirmed`; 422 `POLICY_VERSION_OUTDATED` si la versión no es la vigente (`POLICY_VERSION` en `packages/contracts/src/consent.ts`) |
| PATCH | `/me/profile` | **Implementado.** Solo los campos que cambian: `{ displayName? (2–40), dominantFoot? ('left'\|'right'\|'both'\|null), playsGoalkeeper? }` → `{ profile }`. Exige la política aceptada (`CONSENT_REQUIRED`) |
| PUT | `/me/preferred-positions` | **Implementado.** Reemplaza la lista: `{ positions: PositionCode[] }`, hasta 3, sin repetir y en orden de preferencia → `{ profile }` |
| GET | `/me/export` | **Implementado.** Mis datos en JSON (`MyDataExportSchema`), como descarga (`mis-datos-siempre-de-local.json`, `no-store`): cuenta, perfil, consentimientos, membresías, tests, exámenes (solo resultados), tarjetas y valoraciones sobre mí con sus notas |
| DELETE | `/me` | **Implementado.** `{ confirmation: 'ELIMINAR' }` → 204: borra la cuenta y todo lo suyo en el momento (`04` §5). 409 `LAST_CLUB_ADMIN` (`details.clubs`) si es el único dueño o admin de un club |

## Clubs, equipos e invitaciones

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/clubs` | platform admin |
| GET / POST | `/clubs/:clubId/teams` | club admin |
| GET | `/teams/:teamId` | miembro activo o admin del club. **Implementado:** `{ team: { id, name, format, season, club: { id, name } }, myRoles }` (`TeamResponseSchema`) |
| PATCH | `/teams/:teamId` | **Implementado.** Solo lo que cambia: `{ ratingsVisibleToPlayers?, name? (2–60), format? (el principal), formats? (sin repetir) }` (permiso `team.settings.write`: coach y admin del club). 422 `TEAM_FORMAT_NOT_PLAYED` si el principal no está entre los formatos; 409 `TEAM_NAME_TAKEN` si el club ya tiene ese nombre en la temporada. Auditado (`team.settings_updated`). `GET /teams/:teamId` y `/me` devuelven también `formats` |
| GET | `/teams/:teamId/members` | coach, assistant |
| PATCH / DELETE | `/teams/:teamId/members/:userId` | según matriz. **PATCH implementado** para `{ jerseyNumber: 0–99 \| null }` (permiso `team.members.manage`: coach y admin del club; solo jugadores activos, si no 404 `PLAYER_NOT_IN_TEAM`). El dorsal **puede repetirse** dentro del equipo. 204; queda en `audit_log` (`team.member_updated`) |
| POST | `/teams/:teamId/invitations` | Jugadores: coach o admin del club; cuerpo técnico: solo admin del club. `{ role='player', expiresInDays=7 (1–30), maxUses=30 (1–100) }` → 201 `{ invitation, code, joinUrl }`. Devuelve el código **una sola vez** |
| GET | `/teams/:teamId/invitations` | Lista sin códigos (`{ items }`), con `status`: `active`, `expired`, `used_up`, `revoked`. El coach no ve las de cuerpo técnico |
| DELETE | `/teams/:teamId/invitations/:id` | Revoca → 204, idempotente. 404 si no es de ese equipo |
| GET | `/invitations/:code` | Público: `{ team: { id, name, format }, club: { name }, role }`. El código se acepta en minúsculas o con guiones |
| POST | `/invitations/:code/accept` | Con sesión: une al equipo → 201 `{ teamId, role, alreadyMember }`; si ya era miembro activo no gasta un uso. Exige el consentimiento vigente: si falta, 403 `CONSENT_REQUIRED` |

Errores de invitación: 404 `INVITATION_NOT_FOUND` · 422 `INVITATION_EXPIRED`, `INVITATION_USED_UP`, `INVITATION_REVOKED` · 429 `RATE_LIMITED` (más de 20 peticiones por minuto y por IP entre ver y aceptar). Esquemas en `packages/contracts/src/invitations.ts`.

## Test de orientación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/questionnaires/current` | **Implementado.** Versión vigente para cachear offline: ítems de posición **con pesos** (`QuestionnaireResponseSchema`). `ETag` = id de la versión (inmutable), `If-None-Match` → 304. El formato no cambia el contenido (solo la puntuación), así que no lleva `?format` |
| POST | `/attempts` | **Implementado.** Envío completo (online u offline-sincronizado) → 201, o 200 si se reenvía |
| GET | `/me/attempts` | **Implementado.** Mi historial, del más reciente al más antiguo (`{ items }`) |
| GET | `/attempts/:id` | **Implementado** para el dueño (404 si es ajeno); el staff del equipo, en Fase 3 |
| POST | `/attempts/:id/void` | Anular con motivo (coach) |

`POST /attempts` — cuerpo (v2, solo posición):
```json
{
  "clientAttemptId": "uuid", "teamId": "uuid", "questionnaireVersionId": "uuid",
  "format": "F11", "startedAt": "…", "submittedAt": "…",
  "positionItems": [{ "itemId": "…", "shownOrder": 1, "optionOrder": ["…"], "answerOptionId": "…" }]
}
```
Reglas: `clientAttemptId` repetido (por el mismo usuario) → mismo resultado (200), también si llegan dos a la vez. El servidor calcula el resultado oficial; el podio que muestra el celular sin conexión es provisional. Verifica tantos ítems distintos de esa versión como `positionItemsPerAttempt` (20 en v2), orden mostrado 1..n y que opciones y respuesta sean del ítem.

Errores: 403 `CONSENT_REQUIRED` · 403 si no es jugador activo del equipo (`team.quiz.take`) · 404 equipo inexistente · 422 `FORMAT_MISMATCH` (el formato es el del equipo), `QUESTIONNAIRE_VERSION_UNKNOWN` y `ATTEMPT_INVALID` (ítems que faltan o se repiten, orden fuera de 1..n, opciones o respuesta ajenas al ítem, fechas al revés o en el futuro).

Respuesta (`AttemptResultSchema`):
```json
{ "attemptId": "…", "clientAttemptId": "…", "teamId": "…", "format": "F11", "submittedAt": "…",
  "winner": "DFC",
  "ranking": [{ "pos": "DFC", "pct": 0.82 }],
  "podium": ["DFC", "MCD", "LAT"],
  "suggestedKnowledgeExams": ["DFC", "MCD", "LAT"] }
```
`winner` es la primera del podio. Hasta v1 el cuerpo llevaba `prepItems` y `clientResult` (con `WINNER_MISMATCH`) y la respuesta `prep`; se retiraron con la preparación (`02` §5).

## Examen de conocimiento (certificación)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/certification/positions` | **Implementado.** Por posición: banco disponible, parámetros (ítems, tiempo), mi mejor puntaje (`pct`, `band`, `underReview`) y `nextAttemptAt` |
| POST | `/cert-exams` | `{ position, teamId? }` → inicia examen. Si hay una re-evaluación pendiente para esa posición, se liga sola y no aplica la espera. Devuelve ítems **sin correctas**, `deadlineAt`. 409 `EXAM_IN_PROGRESS`, 422 `ATTEMPT_INTERVAL` (un intento por posición cada 30 días, con `nextAttemptAt`), 422 `NO_PUBLISHED_BANK` |
| **Implementado.** GET | `/cert-exams/:id` | Recuperar un examen en curso (p. ej. tras recargar): ítems y respuestas ya dadas |
| **Implementado.** PUT | `/cert-exams/:id/answers/:itemId` | **Implementado** (204; 422 `ANSWER_INVALID` si la opción no es de esa pregunta). `{ optionId }`. Guarda respuesta (permite cambiarla antes del plazo). 422 `EXAM_DEADLINE_PASSED` |
| POST | `/cert-exams/:id/submit` | **Implementado** (idempotente). Cierra y puntúa. Respuesta abajo |
| POST | `/cert-exams/:id/abandon` | **Implementado.** Abandona; se puntúa lo respondido (lo demás cuenta como fallo) y consume el intento del mes |
| GET | `/me/knowledge` | Mi mejor puntaje por posición, intentos, `nextAttemptAt` y re-evaluaciones pendientes |
| GET | `/me/knowledge-reviews` | Solicitudes de re-evaluación que me han hecho (motivo, plazo, estado) |
| GET | `/me/cert-exams` | **Implementado.** Mis exámenes (puntaje y desglose por área) |

Las respuestas se guardan una a una en el servidor: si se cae la conexión no se pierde el examen, y el plazo lo controla el servidor (con 10 s de margen por la latencia). Un examen vencido se cierra solo al consultarlo, con lo respondido (`endedBy: "timeout"`). Los errores con datos para actuar los llevan en `error.details`: `EXAM_IN_PROGRESS` → `{ examId }`, `ATTEMPT_INTERVAL` → `{ nextAttemptAt }`. Las preguntas nunca llevan la correcta ni la explicación, y el resultado da el desglose por área, no las respuestas.

Respuesta de `submit`:
```json
{ "examId": "…", "position": "DFC", "score": 17, "total": 20, "pct": 0.85,
  "band": "mastery",
  "byArea": [{ "area": "Línea defensiva", "correct": 3, "total": 4 }],
  "bestPct": 0.85, "isNewBest": true, "reviewCompleted": false,
  "plannerWeight": 0.80,
  "nextAttemptAt": "2026-11-19T…" }
```

Staff del equipo:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/teams/:teamId/knowledge` | Por ahora va dentro de `/squad` (`knowledge` por jugador) y del perfil (`knowledge`). La vista para compañeros (solo banda, D11) queda para más adelante |
| POST | `/teams/:teamId/players/:userId/knowledge-reviews` | **Implementado** (coach, admin del club). `{ position, reason (5–500), dueInDays? (1–60, 14 por defecto) }`. 409 `REVIEW_ALREADY_OPEN` si hay una pendiente o vencida; 422 `NO_PUBLISHED_BANK`; 404 `PLAYER_NOT_IN_TEAM`. El jugador la ve en `/certification/positions` (`review`), presenta sin esperar el mes y su resultado reemplaza a los anteriores aunque sea más bajo (los demás quedan `superseded`). Auditado |
| GET | `/teams/:teamId/knowledge-reviews?status=` | Por ahora no: las abiertas van en el perfil del jugador y en la plantilla |
| DELETE | `/teams/:teamId/knowledge-reviews/:id` | **Implementado.** Cancela una pendiente o vencida (409 `REVIEW_CLOSED` si ya se cerró). Auditado |
| POST | `/teams/:teamId/cert-exams/:examId/void` | **Implementado** (coach, admin del club; `team.attempts.void`). `{ reason (5–500), resetInterval? }`. Solo exámenes entregados de jugadores del equipo (si no, 404). 409 `EXAM_ALREADY_VOID`. Pasa a contar el mejor de los restantes; `resetInterval` permite repetir sin esperar el mes. El jugador ve el motivo en `/me/cert-exams` (`voided`). Auditado |

Admin (platform admin, **más adelante**; por ahora los bancos se escriben en el repo, se revisan en un PR y los publica `db:seed`, ver `03` §6): `POST /admin/cert-banks` (borrador, opcionalmente copiando otra versión), `POST/PATCH/DELETE /admin/cert-banks/:id/items[/:itemId]`, `POST /admin/cert-banks/:id/lint` (reglas de calidad), `POST /admin/cert-banks/:id/publish`, `POST /admin/cert-banks/:id/retire` (`{ forQuality: true }` marca sus puntajes "a revisar"), `GET /admin/cert-banks/:id/item-stats` (dificultad y discriminación por ítem).

## Perfil y tarjeta del jugador

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/teams/:teamId/players/:userId/profile` | **Implementado** (staff y admin del club; el jugador ve lo suyo en `/me`, `/me/attempts` y `/me/card`). Agregado para la pantalla de perfil: perfil (nombre, dorsal, pie, preferidas), último test oficial con la clasificación completa (`hidden` para quien valora y aún no lo valoró, como en la plantilla), todas las valoraciones, tarjeta vigente con medias y `cardCount`. 404 `PLAYER_NOT_IN_TEAM`. Los puntajes de conocimiento se suman en la Fase 4 |
| GET | `/teams/:teamId/players/:userId/ratings` | **Implementado** (staff y admin del club). Histórico de fotos, de la más reciente a la más antigua, cada una con autor, notas, valores y `positionAverages` calculadas con la fórmula vigente (`formulaVersion`) |
| POST | `/teams/:teamId/players/:userId/ratings` | **Implementado.** Nueva foto: `{ values: { PAC: 72, … }, notes? }` (coach, assistant). Enteros 0–99: los 6 de campo siempre; los 6 de portero **todos o ninguno** (los agrega el cuerpo técnico si juega o podría jugar de portero; no depende de `playsGoalkeeper`, que es lo que declara el jugador). 400 si no cumple; 404 `PLAYER_NOT_IN_TEAM` |
| GET | `/me/card?teamId=` | **Implementado.** Mi tarjeta vigente `{ card: { ratedAt, values, positionAverages, formulaVersion } \| null }`, sin notas ni autor. 403 `CARD_HIDDEN` si el equipo no la hace visible; 404 si no juego en ese equipo |
| GET | `/rating-attributes` | **Implementado.** Catálogo de atributos (código, nombre, sigla, grupo), anclas de la escala y versión de la fórmula |

Pruebas de campo (futuro, no implementar): `GET /field-tests`, `POST /teams/:teamId/players/:userId/field-tests`, `GET /teams/:teamId/field-tests?test=`.

## Panel del equipo

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/teams/:teamId/squad` | **Implementado** (staff y admin del club). Por jugador activo: nombre visible, dorsal, preferidas, último test oficial (`test.status`: `none`, `hidden` o `visible` con podio), valoración más reciente, `assessedByMe` y `card` (fecha y medias por posición de la foto vigente, o null). **Para quien valora, el test queda `hidden` hasta que valora al jugador.** Los puntajes de conocimiento (Fase 4) se suman después |
| GET | `/teams/:teamId/squad/summary` | Reparto por posición (test, valoración y conocimiento), huecos, conocimiento medio **por posición** (Fase 4), filtro `?format=` |
| GET | `/teams/:teamId/export.csv` | **Implementado** (coach y admin del club, `team.data.transfer`). Una fila por jugador activo: nombre, dorsal, preferidas, test (fecha y podio; `Oculto hasta que lo valores` si quien exporta aún no lo valoró), última valoración, fecha y atributos de la tarjeta y medias por posición del formato. Sin notas. UTF-8 con BOM, todo entre comillas; las celdas que empiezan con `= + - @` se prefijan con `'` (inyección de fórmulas). Queda en `audit_log` (`team.exported`) |

## Valoraciones del entrenador

| Método | Ruta |
|---|---|
| POST | `/teams/:teamId/assessments` — **Implementado** (coach, assistant): `{ playerId, primaryPosition, secondaryPositions (≤2, sin repetir ni la principal), confidence 1–5, notes? }` → 201 `{ assessment }`. `blind` lo decide el servidor. 404 `PLAYER_NOT_IN_TEAM` |
| GET | `/teams/:teamId/assessments?playerId=` — **Implementado** (staff y admin del club): del más reciente al más antiguo |
| GET | `/teams/:teamId/validation` → test vs. entrenador (solo `blind`) y conocimiento vs. tarjeta (Spearman por posición, `rho` null con < 5 jugadores). `team.results.read`; quien valora solo cuenta a los jugadores que ya valoró |

## Alineaciones

| Método | Ruta | Descripción |
|---|---|---|
**Implementado** (2026-10-22). La alineación **se arma en el celular** con `solveLineup` de `@sdl/domain` (`02` §9.5), así funciona sin señal en la cancha; el API da las señales y guarda las alineaciones. Ya no hay `POST /lineups/solve`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/teams/:teamId/lineup-inputs` | Staff y admin del club. `{ format, players: [{ playerId, displayName, jerseyNumber, preferredPositions, affinity?, assessment?, knowledge?, rating? }] }`: las señales de `02` §9.1 tal como las espera el dominio. **Para quien valora y aún no valoró a un jugador, su `affinity` no viaja** (regla a ciegas) |
| GET / POST | `/teams/:teamId/matches` | **Implementado** (Fase 7). Lista (miembros y admin del club; `team.read`), por fecha. Convocar (`team.matches.write`): `{ format, startsAt (con zona), place, opponent }` → 201 `{ match, roster }`. 422 `FORMAT_NOT_PLAYED` (no es de los formatos del equipo), `MATCH_IN_PAST` |
| GET / PATCH | `/teams/:teamId/matches/:matchId` | **Implementado.** `{ match, roster }`: `roster` (quién respondió qué) solo para el cuerpo técnico y el admin del club; `null` para los jugadores. PATCH (`team.matches.write`): solo lo que cambia, `status: 'cancelled'` cancela. 409 `MATCH_CLOSED` si ya empezó o está cancelado. Auditado |
| PUT | `/teams/:teamId/matches/:matchId/reply` | **Implementado.** El jugador: `{ reply: 'yes' \| 'no' }`; cambia hasta la hora del partido (409 `MATCH_CLOSED`). 403 si no es jugador del equipo |
| POST | `/teams/:teamId/lineups` | Coach y assistant (`team.lineups.write`). Guarda la foto: `{ name, matchDate, formation, mode, weights, priority, minKnowledgePct, fitVersion, available, pins, assignments: [{ slotId, playerId, fit, breakdown, pinned, manual }], bench }`. El formato de la alineación es el de la formación (un equipo puede jugar F11 y F8). El servidor no recalcula pero valida: 422 `FORMATION_INVALID` (no existe), `PLAYER_NOT_IN_TEAM`, `LINEUP_INVALID` (puestos que no son los de la formación, jugadores repetidos o no convocados, fijados fuera de su puesto) |
| GET | `/teams/:teamId/lineups` | Staff y admin del club. Resumen, de la más reciente a la más antigua |
| GET / PUT / DELETE | `/teams/:teamId/lineups/:id` | Ver (staff y admin del club); reemplazar o borrar (coach y assistant) |
