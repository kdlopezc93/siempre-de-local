# 03 · Modelo de datos (PostgreSQL)

> Convenciones: `id uuid` (v7, ordenable) como PK; `created_at`/`updated_at timestamptz`; nombres en `snake_case` e inglés; borrado lógico solo donde se indica. Las tablas de identidad (`user`, `session`, `account`, `verification`) las gestiona Better Auth y solo las toca el módulo `identity`.

---

## 1. Diagrama de entidades

```
user ─┬─< account (Google; en el futuro otros proveedores / OIDC)
      ├─< data_consent
      ├── player_profile (1:1) ──< player_preferred_position
      ├─< club_membership >── club ──< team ──< team_membership >── user
      │                                  │
      │                                  ├──< invitation
      │                                  ├──< coach_assessment
      │                                  ├──< player_rating ──< player_rating_value
      │                                  ├──< field_test_result   (futuro)
      │                                  └──< lineup
      │
      ├──< quiz_attempt ── questionnaire_version ──< position_item ──< position_option ──< option_weight
      │       ├──< attempt_item                    └──< prep_item ──< prep_option
      │       ├──< attempt_answer
      │       └──< attempt_result
      │
      └──< cert_exam ── cert_bank_version ──< cert_item ──< cert_option
              └──< cert_exam_item        (el puntaje de cada posición es el mejor cert_exam válido)
```

## 2. Identidad y consentimiento

`user`, `session`, `account`, `verification`: de Better Auth (esquema en `apps/api/src/modules/identity/infrastructure/schema.ts`, migración `0000_identity`). Columnas propias añadidas a `user`: `platform_admin boolean`.
`account` permite varias identidades externas por usuario (hoy solo `provider_id = 'google'`); único `(provider_id, account_id)`.

- Los ids los genera Postgres 18 con `uuidv7()` (Better Auth con `generateId: false`).
- `user.image` queda siempre `null`: la foto de Google no se guarda (`04` §5).
- `account.access_token`, `refresh_token` e `id_token` quedan `null`: los tokens de Google no se usan tras el login y no se guardan.
- `session`: `token` único, `expires_at`, `ip_address`, `user_agent`; borrado en cascada con el usuario.

**data_consent** — aceptación de la política de tratamiento de datos (aplica también a adultos)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| policy_version | text | |
| accepted_at | timestamptz | |
| revoked_at | timestamptz null | |
| age_confirmed | boolean | declaró ser mayor de 18 al aceptar · check: siempre `true` |

Implementado en `apps/api/src/modules/identity/infrastructure/consent.schema.ts` (migración `0004_data_consent`), con índice por `user_id` y borrado en cascada con el usuario. Una fila por versión aceptada (es la prueba de la autorización); la vigente es la de `POLICY_VERSION` sin `revoked_at`.

> Las tablas `guardian_consent`, `birth_year` e `is_minor` del diseño anterior **se eliminan** mientras todos los usuarios sean adultos. Ver `04`, §5.1 para reactivarlas.

## 3. Organización y membresías

**club** — `id, name, slug unique`

**club_membership** — `club_id, user_id, role club_role ('owner','admin')` · PK (club_id, user_id)

**team**

> `format` es el **formato principal** (D14): el del test, la valoración y la tarjeta. `formats match_format[]` son los formatos en que juega; el planificador elige entre ellos por partido. Restricción `team_format_in_formats`: el principal siempre está entre los formatos. Migración `0016_team_formats` (los equipos existentes quedan con `formats = {format}`).
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| club_id | uuid FK | |
| name | text | |
| format | enum `match_format` (`F8`,`F11`) | |
| season | text | |
| ratings_visible_to_players | boolean default true | ¿el jugador ve su tarjeta? (D8) |
| archived_at | timestamptz null | |

**team_membership** — `team_id, user_id, role team_role ('coach','assistant','player'), jersey_number smallint null, joined_at, left_at` · PK (team_id, user_id, role)

**invitation** — `id, team_id, role, code_hash unique, created_by null, expires_at, max_uses, used_count, revoked_at, created_at` · check `0 ≤ used_count ≤ max_uses`
- `code_hash` = SHA-256 del código normalizado (10 caracteres de un alfabeto sin 0/O/1/I/L, ~50 bits); el código en claro no se guarda.
- `created_by` queda en null si se borra la cuenta de quien la creó.
- Aceptar gasta un uso con un `UPDATE … WHERE used_count < max_uses` condicionado, dentro de la misma transacción que crea o reactiva la membresía.

Implementado en `apps/api/src/modules/teams/infrastructure/schema.ts`, migraciones `0002_teams` y `0003_invitations`. Además: `team` es único por `(club_id, name, season)`; `club_membership` y `team_membership` tienen índice por `user_id` y se borran en cascada con el usuario. Un miembro que sale del equipo conserva su fila con `left_at` y deja de contar para los permisos. `jersey_number` (0–99) lo pone el cuerpo técnico y **no es único**: dos jugadores pueden compartir camiseta (decidido el 2026-10-22).

## 4. Perfil del jugador

**player_profile** (1:1 con `user`)
| Columna | Tipo | Notas |
|---|---|---|
| user_id | uuid PK FK | |
| display_name | text | |
| dominant_foot | enum (`left`,`right`,`both`) null | |
| plays_goalkeeper | boolean default false | habilita atributos de portero |

**player_preferred_position** — `user_id, position position_code, rank smallint (1–3)` · PK (user_id, position) · unique (user_id, rank) · check rank 1–3

Implementado en `apps/api/src/modules/player-profile/infrastructure/schema.ts` (migración `0007_player_profile`), con `player_profile.updated_at`; ambas tablas se borran en cascada con el usuario. Mientras no exista la fila, `/me` devuelve el perfil por defecto (nombre visible = el de Google, sin pie, no portero, sin preferidas).

## 5. Test de orientación (versionado)

**questionnaire_version** — `id, label unique, status questionnaire_status ('draft','published','retired'), position_items_per_attempt (15), published_at, created_at`

**position_item** — `id, version_id, code, context position_item_context ('situation','attribute'), text, sort` · unique (version_id, code) y (version_id, sort)
**position_option** — `id, item_id, label, sort` · unique (item_id, sort)
**option_weight** — `option_id, position position_code, points smallint > 0` · PK (option_id, position)
**prep_item** — `id, version_id, position position_code, text, sort` · unique (version_id, position, sort)
**prep_option** — `id, item_id, label, is_correct boolean, sort` · unique (item_id, sort). Índice único parcial `prep_option_one_correct` (como mucho una correcta); "exactamente una" se valida al publicar (`validateOrientationContent`)

Implementado en `apps/api/src/modules/questionnaires/infrastructure/schema.ts` (migración `0001_questionnaire_v1`). El enum `position_code` vive en `shared/db/enums.ts` y sale del orden canónico de `@sdl/domain`. Las FK no borran en cascada: una versión publicada no se borra, se retira.

**Contenido:** `pnpm db:seed` publica `v1` (las 31 de posición y las 64 de preparación del prototipo) y después `v2` (las mismas 31, 20 por intento, sin preparación), que retira a `v1` (idempotente por `label`). Las tablas `prep_*` quedan por el histórico de v1. El contenido se genera con `apps/api/scripts/extract-prototype-content.mjs` y un test comprueba que coincide con `docs/prototipo/detector-posicion.jsx`. Al extraerlo se barajan las opciones de preparación (de forma determinista), porque en el prototipo la correcta siempre era la primera.

**quiz_attempt**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| client_attempt_id | uuid | idempotencia offline; único por usuario |
| user_id | uuid FK | |
| team_id | uuid FK null | |
| questionnaire_version_id | uuid FK | |
| format | `match_format` | |
| status | enum (`in_progress`,`submitted`,`scored`,`void`) | |
| started_at / submitted_at / received_at | timestamptz | |
| void_reason | text null | |

**attempt_item** — `attempt_id, phase ('position','prep'), item_id, shown_order, option_order uuid[]`
**attempt_answer** — `attempt_id, item_id, option_id, answered_at`
**attempt_result** — `attempt_id, scoring_version, winner, ranking jsonb [{pos,pct,earned,maxp}], prep_score, prep_total, is_official, computed_at` · PK (attempt_id, scoring_version)

Implementado en `apps/api/src/modules/quiz/infrastructure/schema.ts` (migración `0005_quiz_attempts`), con estas precisiones:
- `client_attempt_id` es único **por usuario** (`unique (user_id, client_attempt_id)`), no global: un id repetido de otra persona no choca ni revela nada.
- `attempt_item.item_id` y `attempt_answer.item_id/option_id` no llevan FK porque apuntan a `position_*` o `prep_*` según la fase; se validan contra la versión al recibir el intento.
- `attempt_answer.answered_at` = `submitted_at`: el celular no envía la hora de cada respuesta.
- `attempt_result.prep_score/prep_total` admiten null desde la migración `0006_orientation_v2`: solo los intentos v1 tienen preparación.
- Índices: `(user_id, submitted_at desc)` y `(team_id, status)`. Los hijos se borran en cascada con el intento; el intento, con el usuario.

~~**legacy_result**~~ — descartada (2026-10-22): no se importan los resultados del prototipo (`02` §12).

## 6. Certificación

**Bancos implementados** (migración `0012_cert_banks`, módulo `certification`): `cert_area`, `cert_bank_version`, `cert_item`, `cert_option`. Diferencias con lo de abajo: `cert_bank_version` lleva `reviewed_by text` y `reviewed_on date` (quién revisó el contenido, D10) y es única por `(position, label)`; `cert_item` lleva `code` (estable dentro del banco, p. ej. `DFC-AER-03`) y `sort`; `cert_option` tiene un índice único parcial que impide dos correctas por ítem. Los bancos se escriben en el repo (`certification/infrastructure/seed/banks/`) y los publica `db:seed` solo si están revisados y sin errores de lint. **Examen implementado** (migración `0013_cert_exams`): `cert_exam` y `cert_exam_item`. Diferencias: `status` es `in_progress | submitted | void` y un `ended_by` (`submit | abandon | timeout`) dice cómo terminó; un examen vencido se cierra al consultarlo (con lo respondido, `submitted_at = deadline_at`) y cuenta como entregado. `pct` es `numeric(4,3)`. **Anulación y re-evaluación implementadas** (migración `0014_cert_void_reviews`): `cert_exam` suma `review_request_id`, `void_reason`, `voided_by`, `voided_at` y `void_resets_interval`; `cert_review_request` sigue la tabla de abajo con `closed_at`. El índice único parcial es `(player_user_id, position) where status in ('pending','expired')`: **vencida sigue abierta** (se puede presentar y entonces se completa). El vencimiento no es un job: se aplica al leer (`expireDueReviews`).

**cert_bank_version** — un banco por posición y versión
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| position | `position_code` | |
| label | text | |
| status | enum (`draft`,`published`,`retired`) | publicado = inmutable |
| items_per_exam | smallint | 20 |
| time_limit_s | int | 1200 |
| attempt_interval_days | int | 30 | un intento por posición cada N días |
| min_items_to_publish | smallint | 40 |
| retired_for_quality | boolean default false | al retirar por calidad, sus puntajes pasan a "a revisar" |
| difficulty_mix | jsonb | `{ "1": 0.3, "2": 0.5, "3": 0.2 }` |
| published_at | timestamptz | |

Restricción: como máximo una versión `published` por posición a la vez.

**cert_area** — `id, position, code, name` (catálogo de áreas de competencia por posición)

**cert_item**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| bank_version_id | uuid FK | |
| area_id | uuid FK | |
| difficulty | smallint 1–3 | |
| kind | enum (`text`,`pitch_situation`) | |
| text | text | |
| diagram | jsonb null | posiciones para el tipo pizarra (v2) |
| explanation | text | nunca se envía al jugador durante el examen |

**cert_option** — `id, item_id, label, is_correct boolean, sort` · exactamente una correcta

**cert_exam** — un intento de examen
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| team_id | uuid FK null | |
| bank_version_id | uuid FK | |
| position | `position_code` | redundante para consultas |
| status | enum (`in_progress`,`submitted`,`expired`,`void`) | |
| started_at | timestamptz | |
| deadline_at | timestamptz | `started_at + time_limit_s`, fijado por el servidor |
| submitted_at | timestamptz null | |
| score / total | smallint | |
| pct | numeric(4,3) | |
| band | enum (`mastery`,`solid`,`developing`,`insufficient`) | solo para mostrar |
| by_area | jsonb | `[{area, correct, total}]` |
| next_attempt_at | timestamptz | `started_at + attempt_interval_days`; se fija al iniciar |
| under_review | boolean default false | puntaje "a revisar" (§6.5 de `02`); permite repetir sin esperar |
| review_request_id | uuid FK null | si este intento responde a una re-evaluación |
| superseded_at | timestamptz null | lo marca una re-evaluación completada; deja de contar |
| void_reason / voided_by / voided_at | text / uuid / timestamptz, null | anulación por el entrenador |

Índice parcial único: `(user_id) where status = 'in_progress'` → un examen activo por jugador.

**cert_exam_item** — `exam_id, item_id, shown_order, option_order uuid[], answer_option_id uuid null, answered_at`

**Puntaje de conocimiento** — no es una tabla: es el **mejor** `cert_exam` válido (`status = 'submitted'`) de ese jugador y posición. No caduca. Se expone como vista:

```sql
create view knowledge_score as
select distinct on (user_id, position)
       user_id, position, id as exam_id, pct, band, submitted_at, under_review
from cert_exam
where status = 'submitted' and superseded_at is null
order by user_id, position, pct desc, submitted_at desc;
```

**Espera de 30 días:** al iniciar un examen se comprueba el último `cert_exam` de esa posición (cualquier estado salvo `void` con reinicio autorizado): si `now() < next_attempt_at`, se rechaza. Si el último intento tiene `under_review = true`, no se espera.

Al anular un examen (`status = 'void'`) la vista toma automáticamente el mejor de los restantes.

**cert_review_request** — re-evaluación solicitada por el entrenador
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| team_id | uuid FK | |
| player_user_id | uuid FK | |
| position | `position_code` | |
| requested_by | uuid FK | |
| reason | text | obligatorio, visible para el jugador |
| requested_at | timestamptz | |
| due_at | timestamptz | por defecto `requested_at + 14 días` |
| status | enum (`pending`,`completed`,`expired`,`cancelled`) | |
| resolved_exam_id | uuid FK null | examen que la cerró |

Índice parcial único `(player_user_id, position) where status = 'pending'`. Al cerrar un examen ligado a la solicitud: `status = 'completed'` y se marca `superseded_at` en todos los intentos anteriores de esa posición. Un job diario pasa a `expired` las vencidas; mientras haya una `expired` sin resolver, el planificador usa C = 0 para esa posición.

## 7. Tarjeta del jugador

**Implementado** (migraciones `0009_player_rating` y `0010_rating_attribute_catalog`, que siembra el catálogo desde `RATING_ATTRIBUTES` de `@sdl/domain`). Cada foto nueva queda en `audit_log` (`rating.created`); las fotos nunca se editan ni se borran.

**rating_attribute** (catálogo, *seed*)
| Columna | Tipo | Notas |
|---|---|---|
| code | text PK | `PAC`, `SHO`, `PAS`, `DRI`, `DEF`, `PHY`, `GK_DIV`, `GK_HAN`, `GK_KIC`, `GK_REF`, `GK_SPD`, `GK_POS` |
| name_es | text | Ritmo, Tiro, Pase, Regate, Defensa, Físico, Estirada, Manejo, Saque, Reflejos, Velocidad de reacción, Colocación |
| group | enum (`outfield`,`goalkeeper`) | |

**player_rating** — una "foto" de la tarjeta
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| team_id | uuid FK | contexto del equipo (la escala es relativa a su categoría) |
| player_user_id | uuid FK | |
| rated_by | uuid FK | |
| rated_at | timestamptz | |
| source | enum (`manual`,`field_test`) | |
| notes | text null | |

**player_rating_value** — `rating_id, attribute_code, value smallint check (value between 0 and 99)` · PK (rating_id, attribute_code)

Las medias por posición **no se guardan**: se calculan en el dominio con `rating-formula-vN` (§7.3 de `02`).

### 7.1 Pruebas de campo (futuro — esquema reservado, no migrar todavía)

**field_test_type** — `code PK, name, unit, better ('lower','higher'), attribute_code FK, protocol text`
**field_test_reference** — `test_code, category text, sex, value_at_40, value_at_99` (marcas para convertir a 0–99)
**field_test_result** — `id, team_id, player_user_id, test_code, value numeric, attempts jsonb, timing_method ('manual','photocell','app'), measured_at, measured_by, conditions jsonb`

## 8. Cuerpo técnico

**coach_assessment** — `id, team_id, player_user_id, coach_user_id null, primary_position, secondary_positions position_code[] (≤2), confidence 1–5, blind boolean, notes, created_at`

Implementado en `apps/api/src/modules/assessments/infrastructure/schema.ts` (migración `0008_coach_assessment`), con índice `(team_id, player_user_id, created_at desc)`; `coach_user_id` queda en null si se borra la cuenta de quien valoró. **`blind` lo calcula el servidor:** es `true` en la primera valoración de esa persona a ese jugador, porque la app no le muestra el test hasta que la registra (`GET /teams/:id/squad`).

**team_match** — `id, team_id, created_by (set null), format, starts_at timestamptz, place text, opponent text, status match_status ('scheduled','cancelled'), lineup_id (set null, la publicada), published_at, created_at, updated_at`. Índice `(team_id, starts_at)`.

**match_reply** — `match_id (cascade), user_id (cascade), reply match_reply_value ('yes','no'), replied_at` · PK (match_id, user_id). Una por jugador; se reemplaza al cambiar.

**push_subscription** — `id, user_id (cascade), endpoint unique, p256dh, auth, created_at`. Una por navegador: si el celular cambia de cuenta, pasa a la nueva; se borra al apagar los avisos, si el servicio responde 404/410, o con la cuenta (migración `0019_push_subscriptions`).

> **Implementado** (migración `0017_matches`, módulo `matches`, Fase 7). Reglas en `02` §13. La alineación de un partido: `lineup.match_id` (set null; migración `0018_lineup_match`); la publicada es `team_match.lineup_id` + `published_at`.

**lineup**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| team_id | uuid FK | |
| created_by | uuid FK | |
| name | text | |
| format / formation | enum / text | |
| mode | enum (`balanced`,`performance`,`development`) | |
| weights | jsonb | pesos A/V/C/R usados (por si el entrenador los ajustó) |
| fit_version | text | versión del algoritmo de encaje |
| pins | jsonb | `[{slot, player_user_id}]` |
| min_knowledge_pct | numeric(4,3) null | umbral de "conocimiento mínimo"; null = apagado |
| assignments | jsonb | `[{slot, player_user_id, cost, breakdown:{A,V,C,R}}]` |
| bench | uuid[] | |
| match_date | date null | |

Se guarda la foto completa del cálculo: si mañana cambian tarjetas o certificaciones, la alineación guardada sigue explicando por qué se eligió.

**Implementado** (migración `0015_lineup`, módulo `lineups`). Además: `priority` (`none | defensa | ataque`), `available` (los convocados, `uuid[]`), `assignments[].pinned` y `assignments[].manual` (lo tocó el entrenador), `created_at` / `updated_at`; `mode` con los valores de arriba. Índice `(team_id, updated_at desc)`. La alineación se arma en el celular (`02` §9.5); el servidor valida la coherencia de la foto, no la recalcula.

## 9. Auditoría

**audit_log** — `id, actor_user_id, action, entity, entity_id, team_id, at, meta jsonb`. **Implementado** (migración `0011_audit_log`; puerto `AUDIT_LOG` en `shared/audit`). Hoy registra `team.exported`, `rating.created` y `team.settings_updated`; el resto se suma con cada funcionalidad. Se registra: cambios de rol, invitaciones, consentimientos, exportaciones, anulación de intentos y exámenes, **anulación de exámenes de conocimiento, solicitudes de re-evaluación**, **cambios en tarjetas**, borrados.

## 10. Índices clave

- `team_membership (user_id)` y `(team_id, role)` — autorización en cada petición.
- `quiz_attempt (user_id, submitted_at desc)`, `(team_id, status)`.
- `attempt_result (attempt_id) where is_official`.
- `cert_exam (user_id) where status = 'in_progress'` (único).
- `cert_exam (user_id, position, started_at desc)` — comprobar la espera de 30 días.
- `cert_exam_item (item_id)` + `cert_exam (user_id)` — ítems ya vistos por el jugador, para priorizar los no vistos.
- `cert_exam (user_id, position, pct desc) where status = 'submitted'` — vista `knowledge_score`.
- `player_rating (team_id, player_user_id, rated_at desc)`.

## 11. Retención y borrado

- Borrar cuenta: anonimizar intentos y exámenes (romper `user_id`) solo si el club conserva estadísticas agregadas; si no, borrado en cascada. Los exámenes de conocimiento y las tarjetas se borran siempre (son datos personales sin valor agregado).
- Revocar `data_consent` bloquea el tratamiento de sus datos hasta nueva aceptación.
