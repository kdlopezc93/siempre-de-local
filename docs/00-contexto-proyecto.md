# 00 · Contexto del proyecto — Siempre de Local

> **Para Claude:** este es el documento de entrada. Léelo primero en cada conversación. Los demás (`01`–`06`) amplían cada tema. Si algo de aquí contradice a `traspaso-proyecto.md`, **manda este**: el traspaso describe la versión prototipo (artefactos React sueltos); estos documentos describen la versión producto (PWA + backend).

---

## 0. Posicionamiento

**Siempre de Local** quiere ser la mano derecha de los equipos y los técnicos de **fútbol amateur**: equipos donde el fútbol es más pasión que profesión. No es software de club profesional. Promesa: *tu equipo, siempre de local*. El tono de la app es cercano, de barrio y en español latinoamericano.

> Nombre anterior del proyecto: "Futbol Definer Position" (prototipo).

## 1. Qué es

Una aplicación para equipos de fútbol que:

1. **Orienta** a cada jugador sobre su posición ideal mediante un test (situaciones de juego, atributos y conocimiento táctico).
2. **Mide** el conocimiento táctico de un jugador en una posición con un examen más exigente, que da un **puntaje que no caduca**; se puede repetir una vez al mes para mejorarlo.
3. **Mantiene un perfil de jugador** con una tarjeta de atributos (0–99) que puntúa el entrenador, y en el futuro pruebas de campo medidas.
4. **Da al cuerpo técnico** una vista consolidada de la plantilla y un **planificador de alineaciones** que combina todo lo anterior.
5. **Permite validar el test** contra el criterio del entrenador (estudio de validación interno).

El test de orientación es una herramienta **informada por la literatura**, no un instrumento psicométrico validado. El puntaje de conocimiento es un **dato interno de la app**, no un título federativo. Ambas cosas se declaran en la app y condicionan cómo se muestran los datos (ver `02-dominio-y-reglas.md`).

## 2. De dónde venimos

| Etapa | Estado |
|---|---|
| Prototipo | 3 artefactos React de un archivo: `detector-posicion.jsx`, `panel-resultados.jsx`, `planificador-partido.jsx`. Persistencia en `window.storage`, datos entre componentes por CSV copiar/pegar. **Funciona, se conserva como referencia de comportamiento.** |
| Producto (esto) | PWA instalable + API propia + PostgreSQL + autenticación (Google) y autorización por club/equipo/rol. |

Motivos del salto: los datos viajaban a mano (CSV), no había identidad, las respuestas correctas de preparación estaban en el cliente, no se guardaban respuestas crudas (imposible re-puntuar) y no había forma de cruzar el test con la opinión del entrenador.

## 3. Usuarios

**Hoy todos los usuarios son mayores de edad y tienen cuenta de Google.** El diseño de menores (consentimiento de tutor) queda aparcado como fase futura; ver `04`, §5.1.

| Rol | Qué hace |
|---|---|
| **Jugador** | Hace el test de orientación y los exámenes de conocimiento; ve su historial, sus puntajes y su tarjeta. |
| **Entrenador** (y ayudante) | Invita jugadores, ve resultados, puntúa la tarjeta de atributos, registra su valoración de posición, arma alineaciones. |
| **Admin de club** | Crea equipos, asigna entrenadores, gestiona el club. |
| **Admin de plataforma** | Gestiona versiones de cuestionarios y bancos de certificación; soporte. |

Detalle de permisos en `04-auth-seguridad.md`.

## 4. Stack decidido (resumen)

| Capa | Elección |
|---|---|
| Frontend | React + Vite + TypeScript, SPA instalable como PWA (`vite-plugin-pwa`), TanStack Query, React Router |
| Backend | Node + TypeScript con NestJS — **monolito modular** (no microservicios) |
| Base de datos | PostgreSQL, acceso con Drizzle ORM |
| Autenticación | Better Auth con **Google OAuth** como único método inicial, detrás de un puerto `IdentityProvider` (sustituible por OIDC/LDAP vía broker) |
| Autorización | Propia, en la capa de aplicación del backend (membresías por equipo + políticas) |
| API | **REST** + esquemas Zod compartidos (no GraphQL) |
| Repo | Monorepo con pnpm workspaces |

El porqué de cada elección, y por qué no las alternativas, está en `01-arquitectura.md`.

## 5. Principios no negociables

1. **El servidor es la fuente de verdad de todo resultado** (orientación, conocimiento, puntuación de alineación).
2. **Las respuestas correctas nunca viajan al cliente** (preparación y examen de conocimiento).
3. **Se guardan respuestas crudas, no solo puntajes.** Así se puede re-puntuar con nuevos pesos y hacer validación.
4. **Contenido versionado.** Un intento o examen siempre apunta a la versión exacta con la que se respondió.
5. **Mínimo dato personal**, aunque los usuarios sean adultos. La ley de datos personales aplica igual (ver `04`).
6. **Capas con dependencias hacia dentro.** El dominio no conoce frameworks.
7. **Saber qué escala es comparable entre jugadores y cuál no:** la afinidad del test es ipsativa (solo compara posiciones dentro de un jugador); la tarjeta 0–99 y el puntaje de conocimiento sí son comparables entre jugadores. Ver `02`, §10.
8. **La identidad es un detalle sustituible.** Ningún módulo de negocio depende de Google ni de Better Auth; solo del `userId` interno.

## 6. Mapa de documentos

| Doc | Contenido |
|---|---|
| `00-contexto-proyecto.md` | Este. Visión, usuarios, principios. |
| `01-arquitectura.md` | Stack, decisiones (ADR) con alternativas descartadas, capas, monorepo, despliegue. |
| `02-dominio-y-reglas.md` | Posiciones, test de orientación, certificación, tarjeta del jugador, pruebas de campo (futuro), planificador, limitaciones. |
| `03-modelo-datos.md` | Esquema de PostgreSQL. |
| `04-auth-seguridad.md` | Autenticación, roles, matriz de permisos, protección de datos, integridad de exámenes. |
| `05-api.md` | Contrato REST v1. |
| `06-roadmap.md` | Fases, pendientes heredados, decisiones abiertas. |
| `prototipo/` | Código del prototipo (`detector-posicion.jsx`, `panel-resultados.jsx`) y `traspaso-proyecto.md`. Referencia de comportamiento, no se copia tal cual. |

## 7. Glosario

- **Test de orientación**: el test de 23 preguntas (15 de posición + 8 de preparación) heredado del prototipo.
- **Afinidad**: % de puntos obtenidos por una posición sobre el máximo posible en las preguntas servidas.
- **Exposición**: suma, por pregunta servida, del máximo puntaje que una posición podía obtener.
- **Plegado F8**: en Fútbol 8, Pivote suma en Mediocentro y Mediapunta en Delantero.
- **Preparación**: aciertos en 8 preguntas de conocimiento táctico de la posición ganadora (chequeo rápido).
- **Certificación / puntaje de conocimiento**: mejor resultado (0–100%) en el examen de una posición. Sin aprobado ni suspenso; no caduca; un intento por posición cada 30 días; pesa en el planificador según su valor.
- **Tarjeta del jugador**: atributos 0–99 (ritmo, tiro, pase, regate, defensa, físico; o los de portero) puntuados por el entrenador.
- **Media por posición (MP)**: combinación ponderada de los atributos de la tarjeta según la posición.
- **Prueba de campo** (futuro): medición objetiva (sprint 50 m, circuito de conos, precisión de tiro, % de pases) convertida a escala 0–99.
- **Re-evaluación**: el entrenador pide a un jugador repetir el examen de una posición, con motivo; salta la espera y su resultado reemplaza al anterior aunque sea más bajo.
- **K**: puntaje de conocimiento corregido por azar, `max(0, (pct − 0.25)/0.75)`; es lo que usa el planificador.
- **Encaje** (*fit*): puntuación 0–1 de un jugador en un hueco de la alineación, combinando todas las fuentes.
- **Valoración del entrenador** (*coach assessment*): la posición en la que el entrenador ve al jugador.
