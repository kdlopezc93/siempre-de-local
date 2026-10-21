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
| GET | `/me` | Usuario, perfil, membresías, estado del consentimiento |
| POST | `/me/consent` | Aceptar la política vigente (`policyVersion`, `ageConfirmed: true`) |
| PATCH | `/me/profile` | Nombre visible, pie dominante, `playsGoalkeeper` |
| PUT | `/me/preferred-positions` | `[{ position, rank }]` (1–3) |
| GET | `/me/export` | Exportación de mis datos (JSON) |
| DELETE | `/me` | Solicitar borrado de cuenta |

## Clubs, equipos e invitaciones

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/clubs` | platform admin |
| GET / POST | `/clubs/:clubId/teams` | club admin |
| GET | `/teams/:teamId` | miembro |
| PATCH | `/teams/:teamId` | club admin, coach (incluye `ratingsVisibleToPlayers`) |
| GET | `/teams/:teamId/members` | coach, assistant |
| PATCH / DELETE | `/teams/:teamId/members/:userId` | según matriz |
| POST | `/teams/:teamId/invitations` | Devuelve el código **una sola vez** |
| GET | `/teams/:teamId/invitations` | Lista sin códigos |
| DELETE | `/teams/:teamId/invitations/:id` | Revoca |
| GET | `/invitations/:code` | Público: valida y devuelve equipo y rol |
| POST | `/invitations/:code/accept` | Con sesión y consentimiento: une al equipo |

## Test de orientación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/questionnaires/current?format=F11` | Para cachear offline: ítems de posición **con pesos**, de preparación **sin `isCorrect`**. `ETag`. |
| POST | `/attempts` | Envío completo (online u offline-sincronizado) |
| GET | `/me/attempts` | Mi historial |
| GET | `/attempts/:id` | Detalle (dueño o staff del equipo) |
| POST | `/attempts/:id/void` | Anular con motivo (coach) |

`POST /attempts` — cuerpo:
```json
{
  "clientAttemptId": "uuid", "teamId": "uuid", "questionnaireVersionId": "uuid",
  "format": "F11", "startedAt": "…", "submittedAt": "…",
  "positionItems": [{ "itemId": "…", "shownOrder": 1, "optionOrder": ["…"], "answerOptionId": "…" }],
  "prepItems":     [{ "itemId": "…", "shownOrder": 1, "optionOrder": ["…"], "answerOptionId": "…" }],
  "clientResult":  { "winner": "DFC" }
}
```
Reglas: `clientAttemptId` repetido → mismo resultado (200). El servidor recalcula todo; si `clientResult.winner` no coincide → 422 `WINNER_MISMATCH`. Verifica 15 ítems de posición distintos de esa versión, 8 de preparación de la ganadora y opciones de su ítem.

Respuesta:
```json
{ "attemptId": "…", "winner": "DFC",
  "ranking": [{ "pos": "DFC", "pct": 0.82 }],
  "podium": ["DFC", "MCD", "LAT"],
  "prep": { "score": 6, "total": 8, "band": "good" },
  "suggestedKnowledgeExams": ["DFC", "MCD"] }
```

## Examen de conocimiento (certificación)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/certification/positions` | Por posición: banco disponible, parámetros (ítems, tiempo), mi mejor puntaje (`pct`, `band`, `underReview`) y `nextAttemptAt` |
| POST | `/cert-exams` | `{ position, teamId? }` → inicia examen. Si hay una re-evaluación pendiente para esa posición, se liga sola y no aplica la espera. Devuelve ítems **sin correctas**, `deadlineAt`. 409 `EXAM_IN_PROGRESS`, 422 `ATTEMPT_INTERVAL` (un intento por posición cada 30 días, con `nextAttemptAt`), 422 `NO_PUBLISHED_BANK` |
| GET | `/cert-exams/:id` | Recuperar un examen en curso (p. ej. tras recargar): ítems y respuestas ya dadas |
| PUT | `/cert-exams/:id/answers/:itemId` | `{ optionId }`. Guarda respuesta (permite cambiarla antes del plazo). 422 `EXAM_DEADLINE_PASSED` |
| POST | `/cert-exams/:id/submit` | Cierra y puntúa. Respuesta abajo |
| POST | `/cert-exams/:id/abandon` | Abandona; se puntúa lo respondido (lo demás cuenta como fallo) y consume el intento del mes |
| GET | `/me/knowledge` | Mi mejor puntaje por posición, intentos, `nextAttemptAt` y re-evaluaciones pendientes |
| GET | `/me/knowledge-reviews` | Solicitudes de re-evaluación que me han hecho (motivo, plazo, estado) |
| GET | `/me/cert-exams` | Mis exámenes (puntaje y desglose por área) |

Las respuestas se guardan una a una en el servidor: si se cae la conexión no se pierde el examen, y el plazo lo controla el servidor.

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
| GET | `/teams/:teamId/knowledge` | Mejor puntaje de cada jugador por posición (para compañeros: solo la banda) |
| POST | `/teams/:teamId/players/:userId/knowledge-reviews` | `{ position, reason, dueInDays? }` (coach, club admin). 409 si ya hay una pendiente |
| GET | `/teams/:teamId/knowledge-reviews?status=` | Solicitudes del equipo |
| DELETE | `/teams/:teamId/knowledge-reviews/:id` | Cancelar una pendiente |
| POST | `/cert-exams/:id/void` | `{ reason, resetInterval? }` Anular un examen (coach, club admin); pasa a contar el mejor de los restantes. `resetInterval` permite repetir sin esperar el mes |

Admin (platform admin): `POST /admin/cert-banks` (borrador, opcionalmente copiando otra versión), `POST/PATCH/DELETE /admin/cert-banks/:id/items[/:itemId]`, `POST /admin/cert-banks/:id/lint` (reglas de calidad), `POST /admin/cert-banks/:id/publish`, `POST /admin/cert-banks/:id/retire` (`{ forQuality: true }` marca sus puntajes "a revisar"), `GET /admin/cert-banks/:id/item-stats` (dificultad y discriminación por ítem).

## Perfil y tarjeta del jugador

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/teams/:teamId/players/:userId/profile` | Agregado para la pantalla de perfil: datos, posiciones preferidas, último resultado del test, puntajes de conocimiento por posición, tarjeta vigente con medias por posición, última valoración (solo staff). Lo que no puede ver el solicitante se omite. |
| GET | `/teams/:teamId/players/:userId/ratings` | Histórico de fotos de la tarjeta |
| POST | `/teams/:teamId/players/:userId/ratings` | Nueva foto: `{ values: { PAC: 72, … }, notes? }` (coach, assistant). Valores 0–99; atributos de portero solo si `playsGoalkeeper` |
| GET | `/me/card?teamId=` | Mi tarjeta (403 si el equipo no la hace visible) |
| GET | `/rating-attributes` | Catálogo de atributos y anclas de la escala |

Pruebas de campo (futuro, no implementar): `GET /field-tests`, `POST /teams/:teamId/players/:userId/field-tests`, `GET /teams/:teamId/field-tests?test=`.

## Panel del equipo

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/teams/:teamId/squad` | Por jugador: último resultado oficial, puntajes de conocimiento, tarjeta vigente (medias), valoración más reciente |
| GET | `/teams/:teamId/squad/summary` | Reparto por posición (test, valoración y conocimiento), huecos, preparación media **por posición**, filtro `?format=` |
| GET | `/teams/:teamId/export.csv` | Exportación consolidada (auditada) |
| POST | `/teams/:teamId/legacy-import` | Subir CSV del prototipo (multipart) |

## Valoraciones del entrenador

| Método | Ruta |
|---|---|
| POST | `/teams/:teamId/assessments` |
| GET | `/teams/:teamId/assessments?playerId=` |
| GET | `/teams/:teamId/validation` → test vs. entrenador (solo `blind`) y conocimiento vs. tarjeta |

## Alineaciones

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/teams/:teamId/lineups/solve` | Calcula sin guardar |
| POST | `/teams/:teamId/lineups` | Guarda (incluye la foto del cálculo) |
| GET | `/teams/:teamId/lineups` | Listar |
| GET / PATCH / DELETE | `/teams/:teamId/lineups/:id` | |

`POST /lineups/solve` — cuerpo:
```json
{ "format": "F11", "formation": "4-3-3",
  "availablePlayerIds": ["…"],
  "mode": "balanced", "minKnowledgePct": null,
  "weights": { "A": 0.15, "V": 0.30, "C": 0.20, "R": 0.35 },
  "pins": [{ "slot": "GK", "playerId": "…" }] }
```
`weights` es opcional (si falta, los del modo). Respuesta:
```json
{ "fitVersion": "fit-v1",
  "assignments": [{ "slot": "CB1", "position": "DFC", "playerId": "…", "fit": 0.81,
                    "breakdown": { "A": 0.7, "V": 1.0, "C": 0.85, "R": 0.74 } }],
  "bench": ["…"],
  "warnings": [{ "code": "MIN_KNOWLEDGE_INFEASIBLE", "slot": "LB" },
               { "code": "KNOWLEDGE_UNDER_REVIEW", "playerId": "…", "position": "DFC" },
               { "code": "PLAYER_WITHOUT_DATA", "playerId": "…" }] }
```
