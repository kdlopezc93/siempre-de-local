# 06 · Roadmap, pendientes y decisiones abiertas

---

## Fases

Cada fase termina en algo usable, no en "código a medias". Desde la Fase 2, además, desplegado en staging.

### Fase 0 · Cimientos y spikes (riesgos primero)
- Monorepo pnpm, `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, CI.
- Docker compose local con Postgres.
- **Spike auth:** Better Auth en NestJS con Google; cookie compartida entre `app.` y `api.` en local (en staging, Fase 2); puerto `IdentityProvider` definido. Si no convence en 1–2 días → plan B (Auth0/Clerk, ADR-04).
- **Spike PWA:** instalación en Android e iPhone, caché del cuestionario, cola offline en IndexedDB. Android validado; iPhone pendiente (`docs/spikes/pwa.md`).
- ~~Staging con un "hola mundo" con login~~ → movido a la Fase 2: el riesgo de la cookie ya quedó cubierto en local (Caddy con subdominios HTTPS) y por el túnel con un celular real; lo que falta es trabajo de despliegue, no de arquitectura.

### Fase 1 · Dominio con paridad
- Portar puntuación, plegado F8 y preparación a `packages/domain`, con tests de paridad contra el prototipo. *(La preparación se retiró después, en la Fase 2: ver `02` §5.)*
- Desempate determinista.
- *Seed*: contenido del prototipo → `questionnaire_version` v1.

### Fase 2 · Jugador (MVP)
- Invitación → Google → consentimiento → test (online y offline) → resultado oficial → historial.
- Pizarra y podio (UI portada, paleta pizarra). Bases científicas.
- **Cambio del 2026-10-21 (test v2):** 20 preguntas de posición y un podio como resultado; se retira la preparación, que pasa a medirse con la certificación (`02` §2–5).
- Perfil propio: nombre, pie, posiciones preferidas.
- **Antes de invitar al primer equipo:** staging con login en dominio propio (D5) y repetir la prueba sin conexión en un iPhone (`docs/spikes/pwa.md`).

Plan en PRs (acordado el 2026-10-21):

| # | PR | Depende de |
|---|---|---|
| 1 | Clubs, equipos, membresías y autorización (`@Can`, matriz de `04` §2.2); script de alta de club/equipo/entrenador; `GET /teams/:teamId` | — |
| 2 | Invitaciones (API): crear, listar, revocar, validar (pública) y aceptar; código hasheado con caducidad y usos | 1 |
| 3 | Consentimiento (`data_consent`, política v1 en borrador) y `/me` con membresías; sin equipo → "pide tu invitación" | 1 |
| 4 | Pantalla `/unirse/<código>`: Google → política + mayor de 18 → al equipo | 2, 3 |
| 5 | Pantalla mínima del entrenador para invitar (enlace, compartir, revocar), adelantada de la Fase 3 | 2 |
| 6 | Test de orientación (API): intentos, `GET /questionnaires/current` con ETag, `POST /attempts` idempotente con recálculo, historial. Luego, test v2 (solo posición) | 1 |
| 7 | Test (UI): 20 preguntas, podio provisional sin conexión, envío por la cola offline | 6 |
| 8 | Resultado: `shared/ui/Pitch` única, podio con revelado, invitación a certificarse | 7 |
| 9 | Historial y bases científicas | 8 |
| 10 | Perfil propio | 3 |
| 11 | Retirar el código temporal del spike PWA (`spike:pwa` pasa a `preview:tunnel`) | 7 |
| 12 | Staging (D5), despliegue desde CI, Playwright del flujo crítico y prueba en iPhone | todo |

Decisiones de este plan:
- **Política de datos (D7):** borrador v1 en lenguaje claro basado en `04` §5; revisión legal antes del primer equipo real, no antes de programar.
- **Sin invitación:** Better Auth crea el usuario al entrar con Google, pero la app no se puede usar hasta pertenecer a un equipo.
- **Formato del test:** lo da el equipo (F8/F11); si el jugador está en varios, elige equipo al empezar.

### Fase 3 · Entrenador
- Panel: plantilla en pizarra, reparto, huecos, tabla, filtro por formato. *("Preparación media por posición" y "preparación baja en rojo" pasan a la Fase 4 como conocimiento por posición.)*
- **Tarjeta del jugador (entrada manual 0–99)** con anclas e histórico; medias por posición; pantalla de perfil del jugador.
- Valoración del entrenador (con `blind`). Exportación. *(Importar los CSV del prototipo se descartó: el test cambió y los jugadores lo vuelven a hacer, `02` §12.)*

Plan en PRs (acordado el 2026-10-22):

| # | PR | Depende de |
|---|---|---|
| 1 | API: valoraciones del entrenador (`coach_assessment`) y plantilla (`GET /teams/:id/squad`) con el test oculto hasta valorar | — |
| 2 | UI: panel de la plantilla (pizarra con reparto y huecos, tabla) y valorar a cada jugador | 1 |
| 3 | Tarjeta 0–99: catálogo y anclas, `rating-formula-v1` en dominio, fotos e histórico, tarjeta del jugador (D8) | 1 |
| 4 | Perfil del jugador para el cuerpo técnico | 2, 3 |
| 5 | Exportar CSV (con `audit_log`). ~~Importar los CSV del prototipo~~: descartado | 2 |

Decisiones de este plan:
- **Valoración a ciegas impuesta por la app:** quien puntúa (coach o assistant) no ve el resultado del test de un jugador hasta registrar su primera valoración de ese jugador; esa primera queda `blind = true` y es la que sirve para validar el test (`02` §11). Las siguientes, ya con el test a la vista, quedan `blind = false`. El admin del club no valora y ve los resultados.
- El assistant puntúa la tarjeta y valora igual que el coach (`04` §2.2).

### Fase 4 · Examen de conocimiento (certificación)
- **Contenido primero:** escribir y revisar el banco de al menos 2 posiciones piloto (≥ 40 ítems cada una para publicar, objetivo 60, por áreas y dificultad). Sin banco no hay módulo; es la tarea que más tiempo va a llevar y no es de código.
- Lint del banco, publicación, examen con plazo en servidor, selección que prioriza ítems no vistos, un intento por posición cada 30 días, mejor puntaje sin caducidad, anulación, retirada por calidad ("a revisar"), **re-evaluación solicitada por el entrenador** con plazo.
- Ampliar al resto de posiciones.

Plan en PRs (acordado el 2026-10-22):

| # | PR | Estado |
|---|---|---|
| 1 | Dominio: selección del examen, puntaje y bandas, mejor puntaje, cuándo se puede presentar, lint del banco | #39 ✔ |
| 2 | Tablas de los bancos, formato de archivo, publicación en `db:seed` (solo revisados) y lint en la CI; `pnpm bank:lint` con hoja de revisión | #40 ✔ |
| 3 | Banco piloto: borradores de Defensa central y Mediocentro (60 cada uno) para revisar; hojas en `docs/bancos/` | #41 ✔; auditoría #44 ✔; revisado por un entrenador y publicado (falta anotar su nombre) |
| 4 | API del examen: empezar, responder (una a una), entregar o abandonar, plazo en servidor; `/certification/positions`, `/me/cert-exams`; `db:seed -- --drafts` (solo desarrollo) | #42 ✔ |
| 5 | Pantallas del jugador: elegir posición, examen con reloj, resultado con desglose por área | #43 ✔ |
| 6 | API del cuerpo técnico: conocimiento en plantilla, perfil y CSV; anular; re-evaluación | #46 ✔ |
| 7 | Pantallas: lo del PR 6 para el cuerpo técnico, y la re-evaluación y los anulados para el jugador | #47 ✔ (+ arreglo #48) |

Decisiones de este plan:
- **Posiciones piloto:** Defensa central y Mediocentro (distintas entre sí, existen en F8 y F11).
- **Redacción (D10):** Claude redacta un borrador; Kevin y un entrenador revisor lo corrigen. Nada se publica sin `review` en el archivo del banco.
- **Dónde viven los bancos:** archivos en el repo, revisados en un PR y con el lint en la CI. La pantalla de administración queda para cuando haya varios revisores.

### Fase 5 · Alineaciones y validación
**Cerrada el 2026-10-22** (#49–#53). Plan en PRs (decisiones en `02` §9.5):

| # | PR | Estado |
|---|---|---|
| 1 | Dominio: encaje `fit-v1`, húngaro, formaciones F8/F11, fijados, conocimiento mínimo, prioridad por línea, banca y avisos | #49 ✔ |
| 2 | API: señales de cada jugador para el planificador (respetando a ciegas) y guardar alineaciones | #50 ✔ |
| 3 | Planificador en el celular: convocatoria, formato del partido (F11/F8), formación, modos, pizarra, armar a mano (lo movido queda fijado), desglose | #51 ✔ |
| 4 | Guardar y abrir alineaciones: guardar desde el planificador, lista, ver tal como se guardó, editar (abre con todo fijado), borrar | #52 ✔ |
| 5 | Informe de validación: test vs. entrenador (solo `blind`) y conocimiento vs. tarjeta (Spearman por posición), en `/equipos/:id/validacion` | #53 ✔ |

- Reconciliar con `planificador-partido.jsx` (D6): **hecho**, ver `02` §9.5.
- Encaje multi-fuente (A/V/C/R, con C = conocimiento corregido por azar), modos, umbral opcional de conocimiento mínimo, fijar jugadores, desglose explicable.
- Informe de validación (test vs. entrenador; conocimiento vs. tarjeta): **hecho**. Con datos reales de un equipo es la base para afinar pesos en la Fase 8.

### Fase 6 · Experiencia (navegación, inicio y cambio visual)
**Cerrada el 2026-10-22** (#55–#68), con las fotos pospuestas (#65 en borrador).
Agregada el 2026-10-22, al cerrar la Fase 5, por los comentarios del equipo: "no encuentro las cosas", "se ve feo y anticuado" y "hay mucho texto". Auditoría, nueva estructura y plan en `07-experiencia.md`.

| # | PR | Estado |
|---|---|---|
| 1 | Auditoría, nueva estructura y plan (`07-experiencia.md`) | #55 ✔ |
| 2 | Sistema de diseño v2 (contraste verificado; se conservan el icono y las animaciones de entrar) | #56 ✔ |
| 3 | Armazón: encabezado de equipo y barra inferior por rol | #58 ✔ |
| 4 | Inicio "lo que toca" | #59 ✔ |
| 5 | Plantilla: lista compacta, búsqueda, filtros y vista Pizarra | #60 ✔ |
| 6 | Ficha del jugador para el cuerpo técnico | #61 ✔ |
| 7 | Mi juego: tarjeta, posición, conocimiento, historial y perfil | #62 ✔ |
| 8 | Equipo: datos del equipo (nombre, formatos en que juega), integrantes, invitar, informe y cuenta | #63 ✔ |
| 9 | Fotos del jugador y del equipo | **Pospuesto** (2026-10-22, costos de R2): hecho en #65, en borrador |
| 10 | Tus datos: página pública, "Eliminar mis datos", eliminar mi cuenta y descargar mis datos | #66 ✔ |
| 11 | Dieta de texto y afirmaciones respaldadas | #67 ✔ |
| 12 | Auditoría final: diseño, rendimiento, terceros (inventario, `pnpm audit`, CSP) y contraste | #68 ✔ |

### Fase 7 · Partidos: convocatoria, alineación publicada y después del partido
**Cerrada el 2026-10-23** (#69–#77). Lo que queda por hacer con las evaluaciones de los partidos (que alimenten las valoraciones y la validación) pasa a la Fase 8, con datos reales.
Pedida por Kevin el 2026-10-22: "cada vez que sale una fecha me gustaría enviar la convocatoria". Se arma sobre el planificador (Fase 5).

1. **Convocatoria:** el cuerpo técnico crea un partido con fecha, hora, lugar y rival (solo texto) y formato (entre los del equipo, D14). Se la envía a los jugadores.
2. **Aviso a los jugadores:** les llega una notificación (D16) y la ven en el inicio, en "lo que toca". Responden **voy / no voy** (y pueden cambiar hasta que se cierre). El cuerpo técnico ve quién respondió y quién falta.
3. **Alineación con los que van:** el planificador abre con la convocatoria ya hecha (los que dijeron "voy" como disponibles) y la alineación queda **ligada al partido**.
4. **Alineación publicada:** al publicarla, **todo el equipo la ve sin poder editarla** (la pizarra, titulares y suplentes), con otro aviso. El desglose del encaje (tarjeta, test, conocimiento) **no** se muestra a los jugadores: es del cuerpo técnico.
5. **Después del partido** (PR 6–8, D18): guardar el resultado y la figura, y evaluar a los jugadores del partido de 1 a 5 con palabras. Con datos reales, alimentará las valoraciones y la validación (Fase 8).

Plan en PRs (2026-10-22, con D16 y D17 decididos):

| # | PR | Estado |
|---|---|---|
| 1 | Partidos en el API: modelo, reglas en el dominio, convocar, editar o cancelar, y voy / no voy | #69 ✔ |
| 2 | Convocar y responder en la app: lista de partidos, formulario y "lo que toca" | #70 ✔ |
| 3 | La alineación del partido: el planificador abre con los que van; publicar y republicar | #72 ✔ |
| 4 | La alineación publicada para todo el equipo, sin editar ni desglose | #73 ✔ |
| 5 | Notificaciones push (Web Push, D16), con su fila en el inventario de terceros (`04` §6) | #74 ✔ |
| 6 | Después del partido en el API: resultado, figura, evaluaciones de 1 a 5 y quién las ve (D18); política `borrador-3` | #75 ✔ |
| 7 | Cargar el resultado y evaluar en la app (cuerpo técnico): el partido jugado, "lo que toca", el ajuste en Equipo y la evaluación partido a partido en la ficha | #76 ✔ |
| 8 | El jugador ve el resultado y la figura en el partido, y su evaluación (si el equipo la muestra) en el partido y en Mi juego; push de felicitación a la figura; política `borrador-4` | #77 ✔ |

El punto 5 (después del partido) se sumó el 2026-10-23 como PR 6–8.

### Pendientes sueltos (después de la Fase 7)
Elegidos por Kevin el 2026-10-23, antes del staging o la Fase 8: cosas chicas que se notan en el uso diario.

| # | PR | Estado |
|---|---|---|
| 1 | Integrantes en Equipo para todos: cuerpo técnico y jugadores con su mejor banda (D11, sin puntaje) | #79 ✔ |
| 2 | Avisar antes de salir con cambios sin guardar (formularios y el marcador del partido) | #80 |
| 3 | El nombre del entrenador revisor en los bancos del examen (D10), cuando Kevin lo tenga | |

### Fase 8 · Contenido, psicometría y medición
Empezada el 2026-10-23 por lo que no necesita datos reales. Kevin eligió primero el test de orientación a ~40 preguntas (las revisa él; no depende del entrenador revisor de D10).

| # | PR | Estado |
|---|---|---|
| 1 | Control de calidad del test (`pnpm quiz:lint`): estructura y cobertura por posición, en el banco y por intento | #81 ✔ |
| 2 | v3 en borrador: ~9 preguntas nuevas para lateral, mediocentro y extremo, con su hoja de revisión para Kevin. No se publica sin `review` | #82 ✔ |
| 3 | Publicar v3 después de la revisión (seed, tests) | #83 ✔ |
| 4 | Preguntas tipo pizarra en el examen: formato, servido y pizarra en la web; se responde tocando en la cancha o en la lista (Kevin, 2026-10-23) | #84 ✔ |
| 5 | Primeras preguntas de pizarra para DFC y MC (borradores, esperan revisor, D10), con la pizarra en la hoja de revisión | #85 ✔ |
| 6 | Bancos de las demás posiciones, uno por PR (borradores, esperan revisor, D10): Lateral (64, con 4 de pizarra), y después Delantero centro, Extremo, Pivote, Mediapunta y Portero | #86 ✔ (Lateral), #87 ✔ (Delantero centro), #88 (Extremo), #89 (Pivote), #90 (Mediapunta), #91 (Portero) |

Después, en el orden que se decida: la herramienta de análisis de preguntas. Con datos reales del equipo: afinar pesos y analizar las preguntas.

- Ampliar el banco de posición del test de orientación a ~40 ítems (hoy 31, 20 por intento).
- Análisis de ítems de los bancos de conocimiento (dificultad, discriminación) → nuevas versiones del banco.
- Afinar pesos del test, de las medias por posición y del encaje con datos reales.
- Ítems tipo pizarra en los bancos de conocimiento.
- Usar las evaluaciones de los partidos (D18) en las valoraciones, el planificador y la validación, cuando haya temporada suficiente.
- **Pruebas de campo** (sprint, conos, tiro, pase, resistencia): protocolo, marcas de referencia, conversión a 0–99.

## Pendientes heredados del prototipo → dónde quedan

| Pendiente (traspaso §6) | Destino |
|---|---|
| 1. Afinar ponderaciones con estudios | Fase 8 |
| 2. Estudio de validación con el equipo | Fase 5 |
| 3. Panel con historial propio | Resuelto por la BD |
| 4. Preparación media por posición | Fase 4, como conocimiento por posición (la preparación se retiró) |
| 5. Filtro por formato y rojo en baja preparación | Filtro: Fase 3 · rojo en bajo conocimiento: Fase 4 |
| 6. Cómo compartir con el equipo | Resuelto: invitación a la PWA |

## Bugs/deuda del prototipo a no arrastrar
- Portada decía "20 preguntas" (son 23).
- `POSITIONS` duplicado con coordenadas distintas entre test y panel.
- Respuesta correcta siempre en índice 0 de los datos y en el cliente.
- `useMemo` importado sin usar.
- Nombre libre sin identidad.

## Decisiones tomadas en esta revisión
- Autenticación **solo con Google** mientras todos sean adultos con cuenta de Google (ADR-04).
- Identidad como **módulo** del monolito con puerto sustituible, **no microservicio** (ADR-07).
- **REST**, no GraphQL (ADR-08).
- Nuevos módulos: examen de conocimiento por posición, tarjeta 0–99, encaje multi-fuente en el planificador. Pruebas de campo: diseño preliminar, sin implementar.
- Certificación sin aprobado/suspenso: cuenta el **mejor** intento, **no caduca**, **un intento por posición cada 30 días** (repetir es para mejorar); el entrenador puede pedir re-evaluación con motivo, que salta la espera y reemplaza el puntaje aunque baje; peso en el planificador proporcional al puntaje corregido por azar (`02` §6 y §9).
- Se retira el flujo de menores (queda documentado para reactivarlo, `04` §5.1).
- Nombre del producto: **Siempre de Local**, enfocado en fútbol amateur (`00` §0).

## Decisiones abiertas

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| D1 | ¿El jugador ve su preparación? | **Ya no aplica:** la preparación se retiró del test (v2, 2026-10-21) |
| D2 | ¿El jugador ve las valoraciones del entrenador sobre él? | **Decidido: no** (2026-10-22) |
| D3 | ¿Multi-club desde el día 1? | Modelo multi-club, UI de un club |
| D4 | ¿Cuántos intentos del test cuentan? | Todos se guardan; panel usa el último oficial; el entrenador puede anular |
| D5 | Dominio y hosting | Elegir al cerrar la Fase 2, antes del primer equipo. Comparativa de oct-2026: Cloudflare (dominio, DNS, Pages) + Fly.io (API en `iad`) + Neon (`us-east-1`), ≈ US$0–4/mes en staging; dominio candidato `siempredelocal.app`. Revisar precios al momento |
| D6 | Adjuntar `planificador-partido.jsx` | **Resuelto** (2026-10-22): se conserva su mecánica y se cambia su puntaje por el encaje v2 (`02` §9.5) |
| D7 | Revisión legal de la política de datos | Antes de usar con equipos reales. Borrador en `docs/legal/politica-tratamiento-datos.md`: completar los `[…]` (responsable, contacto, plazos) y revisar la transferencia internacional (art. 26) |
| D8 | ¿El jugador ve su tarjeta 0–99? | **Decidido: sí, configurable por equipo** (`team.ratings_visible_to_players`, interruptor del entrenador) (2026-10-22) |
| D9 | Vigencia del puntaje de conocimiento | **Decidido: no caduca.** Un intento por posición cada 30 días. Reabrir solo si se ve que puntajes viejos no reflejan la realidad |
| D10 | ¿Quién escribe los bancos de conocimiento? | Kevin + un entrenador revisor por posición; nunca un entrenador cuyos jugadores vayan a examinarse sin rotar revisores |
| D11 | ¿Los compañeros ven el conocimiento de otros? | Solo la banda, sin puntaje. **Hecho** (2026-10-23): la mejor banda con su posición, en Integrantes; "Insuficiente" no se muestra a los compañeros |
| D12 | Formación por defecto para F8 y F11 en el planificador | **Decidido** (2026-10-22): F8 1-3-3-1 (más 1-2-4-1, 1-3-4, 1-2-3-2, del prototipo); F11 1-4-3-3 (más 1-4-4-2, 1-4-2-3-1, 1-3-5-2) |
| D13 | Plazo por defecto para presentar una re-evaluación | 14 días; al vencer, C = 0 en el planificador hasta que presente |
| D14 | Equipos que juegan varios formatos: qué formato usa cada cosa | **Decidido** (2026-10-22, Kevin): el test, la valoración y la tarjeta usan el **principal** (`team.format`); el planificador elige por partido entre los formatos del equipo (`team.formats`) |
| D15 | Dónde se guardan las fotos | **Decidido** (2026-10-22, Kevin): Cloudflare R2 (junto con el hosting de D5), servidas por el API del mismo dominio. En local, el disco, detrás del mismo puerto. Exige actualizar la política de datos (D7) |
| D16 | Cómo llegan los avisos de la Fase 7 (convocatoria, alineación publicada) | **Decidido** (2026-10-22, Kevin): **primero en el inicio** ("lo que toca"); las **notificaciones push** (Web Push; en iPhone solo con la app instalada, iOS 16.4+) en un PR propio al final de la fase. Sin WhatsApp ni correo |
| D17 | Alineación publicada: quién la ve y si se puede cambiar | **Decidido** (2026-10-22, Kevin): la ve **todo el equipo**, sin el desglose del encaje; el cuerpo técnico puede **republicarla** (avisa de nuevo) **hasta la hora del partido**; después queda fija |
| D18 | Después del partido: cómo se evalúa y quién lo ve | **Decidido** (2026-10-23, Kevin): **1 a 5 con palabras** (Flojo · Regular · Bien · Muy bien · Figura) y nota opcional del cuerpo técnico; el jugador ve **la suya, sin nota, según un ajuste del equipo** (como la tarjeta, D8; por defecto, sí). El resultado y la figura del partido los ve todo el equipo |

## Cómo trabajar con Claude en este proyecto
- Empezar cada conversación leyendo `00-contexto-proyecto.md`.
- Si una tarea cambia una decisión de `01`, actualizar el ADR en la misma tarea.
- Cambios de esquema → actualizar `03` y la migración juntos.
- Cambios de endpoints → actualizar `packages/contracts` y `05`.
- Cambios de reglas de puntuación, certificación o encaje → nueva versión del algoritmo y actualizar `02`.
