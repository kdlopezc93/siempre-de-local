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
- **Antes de invitar al primer equipo:** staging con login en dominio propio (D5) y repetir el spike PWA en un iPhone.

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
| 11 | Retirar el código temporal del spike PWA | 7 |
| 12 | Staging (D5), despliegue desde CI, Playwright del flujo crítico y prueba en iPhone | todo |

Decisiones de este plan:
- **Política de datos (D7):** borrador v1 en lenguaje claro basado en `04` §5; revisión legal antes del primer equipo real, no antes de programar.
- **Sin invitación:** Better Auth crea el usuario al entrar con Google, pero la app no se puede usar hasta pertenecer a un equipo.
- **Formato del test:** lo da el equipo (F8/F11); si el jugador está en varios, elige equipo al empezar.

### Fase 3 · Entrenador
- Panel: plantilla en pizarra, reparto, huecos, tabla, filtro por formato. *("Preparación media por posición" y "preparación baja en rojo" pasan a la Fase 4 como conocimiento por posición.)*
- **Tarjeta del jugador (entrada manual 0–99)** con anclas e histórico; medias por posición; pantalla de perfil del jugador.
- Valoración del entrenador (con `blind`). Importación de CSV heredados. Exportación.

### Fase 4 · Examen de conocimiento (certificación)
- **Contenido primero:** escribir y revisar el banco de al menos 2 posiciones piloto (≥ 40 ítems cada una para publicar, objetivo 60, por áreas y dificultad). Sin banco no hay módulo; es la tarea que más tiempo va a llevar y no es de código.
- Lint del banco, publicación, examen con plazo en servidor, selección que prioriza ítems no vistos, un intento por posición cada 30 días, mejor puntaje sin caducidad, anulación, retirada por calidad ("a revisar"), **re-evaluación solicitada por el entrenador** con plazo.
- Ampliar al resto de posiciones.

### Fase 5 · Alineaciones y validación
- Reconciliar con `planificador-partido.jsx` (D6).
- Encaje multi-fuente (A/V/C/R, con C = conocimiento corregido por azar), modos, umbral opcional de conocimiento mínimo, fijar jugadores, desglose explicable.
- Informe de validación (test vs. entrenador; conocimiento vs. tarjeta).

### Fase 6 · Contenido, psicometría y medición
- Ampliar el banco de posición del test de orientación a ~40 ítems (hoy 31, 20 por intento).
- Análisis de ítems de los bancos de conocimiento (dificultad, discriminación) → nuevas versiones del banco.
- Afinar pesos del test, de las medias por posición y del encaje con datos reales.
- Ítems tipo pizarra en los bancos de conocimiento.
- **Pruebas de campo** (sprint, conos, tiro, pase, resistencia): protocolo, marcas de referencia, conversión a 0–99.

## Pendientes heredados del prototipo → dónde quedan

| Pendiente (traspaso §6) | Destino |
|---|---|
| 1. Afinar ponderaciones con estudios | Fase 6 |
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
| D2 | ¿El jugador ve las valoraciones del entrenador sobre él? | No |
| D3 | ¿Multi-club desde el día 1? | Modelo multi-club, UI de un club |
| D4 | ¿Cuántos intentos del test cuentan? | Todos se guardan; panel usa el último oficial; el entrenador puede anular |
| D5 | Dominio y hosting | Elegir al cerrar la Fase 2, antes del primer equipo. Comparativa de oct-2026: Cloudflare (dominio, DNS, Pages) + Fly.io (API en `iad`) + Neon (`us-east-1`), ≈ US$0–4/mes en staging; dominio candidato `siempredelocal.app`. Revisar precios al momento |
| D6 | Adjuntar `planificador-partido.jsx` | Necesario antes de Fase 5 |
| D7 | Revisión legal de la política de datos | Antes de usar con equipos reales. Borrador en `docs/legal/politica-tratamiento-datos.md`: completar los `[…]` (responsable, contacto, plazos) y revisar la transferencia internacional (art. 26) |
| D8 | ¿El jugador ve su tarjeta 0–99? | Sí, configurable por equipo |
| D9 | Vigencia del puntaje de conocimiento | **Decidido: no caduca.** Un intento por posición cada 30 días. Reabrir solo si se ve que puntajes viejos no reflejan la realidad |
| D10 | ¿Quién escribe los bancos de conocimiento? | Kevin + un entrenador revisor por posición; nunca un entrenador cuyos jugadores vayan a examinarse sin rotar revisores |
| D11 | ¿Los compañeros ven el conocimiento de otros? | Solo la banda, sin puntaje |
| D12 | Formación por defecto para F8 y F11 en el planificador | Definir con el planificador original |
| D13 | Plazo por defecto para presentar una re-evaluación | 14 días; al vencer, C = 0 en el planificador hasta que presente |

## Cómo trabajar con Claude en este proyecto
- Empezar cada conversación leyendo `00-contexto-proyecto.md`.
- Si una tarea cambia una decisión de `01`, actualizar el ADR en la misma tarea.
- Cambios de esquema → actualizar `03` y la migración juntos.
- Cambios de endpoints → actualizar `packages/contracts` y `05`.
- Cambios de reglas de puntuación, certificación o encaje → nueva versión del algoritmo y actualizar `02`.
