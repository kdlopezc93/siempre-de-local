# 08 · Visión de ecosistema (borrador para discutir)

> **Estado:** idea de Kevin del 2026-10-26, todavía sin decidir. Nada de esto cambia el producto actual ni los ADR hasta que se decida; cuando se decida, se actualizan `00` (posicionamiento), `01` (arquitectura), `04` (menores) y el roadmap.

## 1. La idea

Dejar de pensar la app solo para equipos de barrio y verla como un **ecosistema deportivo**: muchos módulos que conviven sobre una base común, cada uno con su nicho, todos enfocados en el deporte. Un equipo de barrio usa unos pocos; una **escuela deportiva** usa más, sobre todo los **administrativos** y una **evaluación más fuerte**.

## 2. A quién le sirve (segmentos)

| Segmento | Qué necesita | Módulos que usaría |
|---|---|---|
| **Equipo de barrio** (lo de hoy) | Organizar el partido, saber quién va, armar la alineación, la plata de la cancha | Núcleo · Deportivo · Evaluación básica · La vaca |
| **Escuela deportiva** | Inscripciones y mensualidades, grupos por categoría y edad, seguimiento del desarrollo de cada niño, informes a los papás, horarios y sedes | Núcleo · Administrativo · Evaluación y desarrollo · Entrenamiento · Familias · Deportivo |
| **Club o liga** (más adelante) | Varios equipos o escuelas, torneos, tablas, inscripción de equipos | Todo lo anterior · Competencia |

## 3. Los módulos

### Núcleo (lo comparten todos)
- **Identidad y cuentas:** Google hoy; para escuelas, cuentas de **menores** creadas por el acudiente o la escuela (ver §5).
- **Organizaciones:** club, escuela, equipo, **categoría o grupo** (sub-10, sub-12…), **sede**. Hoy existe club → equipo.
- **Personas y roles:** jugador, entrenador, asistente, admin del club; nuevos: **acudiente**, **administrativo** (cobra, inscribe), **coordinador deportivo** (ve todas las categorías).
- **Avisos, auditoría, datos personales y consentimientos** (ya existen).
- **Qué módulos tiene activos cada organización:** la base para planes y cobro (ver "Monetizar" en `06`).

### Deportivo (lo que hay hoy)
Partidos, convocatoria, alineación publicada, después del partido, planificador, pizarra, lesionados.

### Evaluación y desarrollo (el módulo fuerte)
- **Hoy:** test de orientación, examen de conocimiento, tarjeta 0–99, valoración del cuerpo técnico, evaluación por partido.
- **Pruebas de campo** medidas (velocidad, resistencia, técnica), por edad, con baremos por categoría.
- **Evaluaciones periódicas** (trimestrales, por temporada) con la misma plantilla para todos los de una categoría, para comparar en el tiempo.
- **Seguimiento longitudinal:** la curva de cada jugador temporada a temporada.
- **Plan de desarrollo individual:** objetivos por jugador, revisados por el entrenador.
- **Informes para el acudiente:** cómo va su hijo, en lenguaje de papá, no de entrenador.
- Distinguir siempre qué es comparable entre jugadores y qué no (principio 7 de `00`).

### Entrenamiento
Planificar sesiones, banco de ejercicios (la pizarra sirve), asistencia a entrenos, carga.

### Administrativo (para escuelas)
- **Inscripciones y matrículas**, con los documentos que pida la escuela.
- **Mensualidades y cartera:** quién está al día y quién debe; recordatorios de pago.
- **Grupos, horarios, sedes y canchas.**
- **Uniformes e implementos.**
- Para el equipo de barrio, la versión chica: **la vaca** (cuánto toca por cabeza y quién pagó).

### Familias (para escuelas)
Portal del acudiente: horarios, avisos, autorizaciones (viajes, torneos), pagos e informes de desarrollo.

### Competencia (más adelante)
Torneos, fixture, tablas de posiciones, goleadores, historial contra cada rival.

### Comunidad (hacia afuera)
Página pública del equipo o escuela, buscar rival para amistosos, compartir la alineación como imagen, patrocinio de comercios del barrio.

## 4. Cómo encaja con lo que ya hay

- **La arquitectura aguanta:** el API ya es un **monolito modular** (ADR) con módulos que se hablan por puertos. Cada módulo nuevo es un módulo más; no hace falta pasar a microservicios.
- **Regla para crecer (2026-10-26):** módulos separados desde ya, **un solo despliegue**. Un módulo se saca a su propio servicio solo con una razón concreta: aislar pagos (aunque lo normal es una pasarela externa, sin procesar tarjetas), trabajos pesados (informes, video; se corren en un proceso aparte con el mismo código) u otro equipo de desarrollo dueño de ese módulo. "Ecosistema" es del producto, no de cuántos programas se despliegan.
- **El modelo ya es multi-club** (D3): falta el nivel de **categoría o grupo**, la **sede** y los **roles** nuevos.
- **Activar módulos por organización** es lo que permite cobrar por planes sin tener apps distintas.

## 5. Lo que hay que decidir antes de construir

1. **Posicionamiento y tono.** Hoy la promesa es "tu equipo, siempre de local" y el tono es de barrio, explícitamente no de club profesional. Una escuela necesita un tono más formal en lo administrativo y con los papás. ¿Una sola voz, o el tono de barrio para lo deportivo y uno más claro para lo administrativo?
2. **Menores de edad.** Las escuelas son casi todas de niños. Esto activa el diseño aparcado de `04` §5.1: autorización del representante legal (régimen reforzado de la Ley 1581), cuentas sin Google, acudiente que ve y autoriza. **Es el cambio más grande y pasa por revisión legal antes.** También cambia qué evaluaciones se le muestran a un niño y cómo.
3. **¿Solo fútbol o varios deportes?** "Escuelas deportivas" puede ser multideporte. Lo de hoy (posiciones, formaciones, pizarra) es de fútbol; lo administrativo y parte de la evaluación (pruebas físicas, asistencia) sirven para cualquier deporte.
4. **Plata de por medio.** Cobrar mensualidades dentro de la app exige pasarela de pago y otras obligaciones; registrar quién pagó (sin cobrar en la app) es mucho más simple para empezar.
5. **Orden.** Qué segmento primero: seguir puliendo el equipo de barrio (que ya lo usa) o abrir una escuela piloto.

## 5b. Monetización

Estudio de mercado y alternativas en `09-estudio-mercado.md` (2026-10-27). En corto: gratis para el equipo de barrio (ingresos por alianzas y patrocinio local, sin publicidad); plan por escuela con precio por deportista, donde la **evaluación** es lo que diferencia y justifica el precio; comisión por pagos solo si una escuela pide cobrar en la app.

## 6. Próximo paso

Revisar las ideas una por una, con alcance y forma de ejecución, y ordenarlas en fases en `06`.

## 7. Revisión de ideas, una por una (2026-10-26 y 27, Kevin)

| # | Idea | Decisión |
|---|---|---|
| 1 | Goles, asistencias y tarjetas | **Sí.** Los carga el cuerpo técnico en "después del partido", eligiendo de "quién vino". Cada gol con asistencia opcional; autogol del rival aparte. Tabla de goleadores y asistidores para **todo el equipo**; los números de cada uno en su perfil. **Tarjetas** amarillas y rojas: se anotan y se muestran; la suspensión la marca a mano el cuerpo técnico (reglas automáticas, con el módulo de torneo). Sin minutos jugados |
| 2 | Figura votada por los compañeros | **Descartada** |
| 3 | Entrenos con convocatoria y asistencia | **Más adelante** (después del MVP de lo prioritario). La asistencia a partidos sale antes con "quién vino" |
| — | **"¿Quién vino?"** (salió de usar la app el 2026-10-25) | **Sí, va primero.** Desde la hora del partido, el cuerpo técnico y el tesorero marcan quién vino: arranca con los que dijeron "voy"; se agrega al que llegó sin confirmar y se quita al que no apareció; se corrige sin plazo. Manda en todo lo de después: la vaca, goles y tarjetas, evaluaciones (reemplaza "Agregar a otro que jugó"). Da el % de asistencia a partidos. El voy / no voy sigue cerrando a la hora |
| 4 + 5 | La vaca y las cuotas → **cobros** | **Sí.** Un cobro es de un partido o suelto (uniformes, inscripción a un torneo, cuota). Se le cobra a quien se elija (los que vinieron, todos o algunos a mano); un total que se reparte o un valor por persona, con ajuste por persona. **Patrocinios:** la parte de un jugador la asume otro (o varios, o "el equipo"); la deuda queda en quien patrocina y el patrocinado ve "pagada"; quién patrocinó solo lo ven tesorero y cuerpo técnico. Casilla **"cobrarles también a los que dijeron 'voy' y no vinieron"** (recuerda la última elección). **El cobro nunca se crea solo:** los partidos del campeonato no se cobran. Se paga por fuera (Nequi, Daviplata, efectivo): el jugador toca "Ya pagué" y el tesorero confirma; sin pasarela. **Quién debe** lo ven el tesorero y el cuerpo técnico; cada jugador, lo suyo. Recordatorio a los que deben y saldo del equipo. Cuotas que se repiten cada mes, más adelante |
| — | **Rol de tesorero** | **Sí.** Lo asigna el entrenador o el admin del club; puede ser un jugador. Maneja cobros, confirma pagos y marca "quién vino". No arma alineaciones ni evalúa. Mientras no exista el módulo de roles, se nombra desde la ficha del integrante |

**Orden que sale de aquí:** "quién vino" → goles, asistencias y tarjetas → cobros (3 PRs: cobros y pagos; patrocinios y ajustes; recordatorio y saldo).
