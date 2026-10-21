# 01 · Arquitectura y decisiones

> Cada decisión lleva su alternativa descartada y el motivo. Si se quiere cambiar una, se cambia aquí primero.

---

## 1. Forma del sistema

```
┌─────────────────────────┐        HTTPS (cookies de sesión, mismo sitio)
│  PWA (React, estática)  │ ───────────────────────────────┐
│  app.<dominio>          │                                ▼
│  - Service Worker       │                    ┌───────────────────────┐
│  - IndexedDB (cola)     │                    │  API (NestJS)          │
└─────────────────────────┘                    │  api.<dominio>         │
                                               │  /api/auth/* (Better   │
                                               │   Auth)                │
                                               │  /api/v1/*  (negocio)  │
                                               └──────────┬────────────┘
                                                          │
                                               ┌──────────▼────────────┐
                                               │  PostgreSQL gestionada │
                                               └────────────────────────┘
```

Frontend y API en **subdominios del mismo dominio** para que las cookies de sesión sean de primera parte (`SameSite=Lax`) y no haya que pelear con cookies de terceros, que Safari bloquea.

## 2. Decisiones (ADR)

### ADR-01 · Frontend: React + Vite (SPA), no Next.js, no Svelte, no Angular

**Decisión:** React con Vite como SPA, instalable como PWA.

**Por qué React, siendo críticos:**
- No es porque sea "el mejor". Es porque **ya hay ~1.500 líneas funcionando en React** y la lógica de UI (pizarra SVG, flujo del test, tabla ordenable) se porta casi directa. Reescribir en otro framework es coste sin beneficio para el usuario.
- El ecosistema que necesitamos es maduro en React: TanStack Query (caché + reintentos, clave para offline), `vite-plugin-pwa`, librerías de formularios y accesibilidad.
- Es la opción con más mercado si el proyecto además sirve de portafolio.

**Alternativas descartadas:**
| Opción | Por qué no |
|---|---|
| **Next.js** | Su valor es SSR/SEO y rendering en servidor. Esta app vive detrás de login, no necesita SEO y debe funcionar offline: el SSR añade un servidor más y complica el service worker sin ganar nada. |
| **SvelteKit** | Técnicamente sería más ligera y simple; es la alternativa más seria. Se descarta solo por coste de migración y por ecosistema PWA/offline algo menor. Si se empezara de cero, sería empate técnico. |
| **Angular** | Muy estructurado y familiar para gente de Java, pero pesado para una app de este tamaño y obliga a reescribir todo. |
| **React Native / Expo** | Aporta acceso nativo, pero el requisito es enlace + instalación sin tiendas. Se reconsidera solo si se necesitan notificaciones push fiables en iPhone (en iOS las push web solo funcionan con la PWA instalada). |

### ADR-02 · Backend: Node + TypeScript con NestJS, no Spring Boot

**Decisión:** NestJS sobre Node, en TypeScript.

**El argumento decisivo no es "qué lenguaje es mejor".** Es este: la lógica de puntuación (`packages/domain`) tiene que ejecutarse **en dos sitios**:
1. En el cliente, para que el jugador complete el test offline y vea su **podio provisional** en el momento, sin señal. *(Hasta v1 también servía para elegir la ganadora y servir sus 8 de preparación; ver `02` §5.)*
2. En el servidor, para recalcular el resultado oficial.

Con TypeScript en ambos lados es **un único paquete con sus tests**. Con Java habría dos implementaciones (TS en el cliente, Java en el servidor) que tarde o temprano divergen, y eso en un algoritmo de puntuación es un bug silencioso de los peores. Lo mismo aplica a los contratos de la API (esquemas Zod compartidos → tipos en el front sin generar código).

**Forma del backend:** **monolito modular** — un solo despliegue, módulos con fronteras claras y sin tablas compartidas entre módulos salvo `user.id` y `team.id`. Para un desarrollador y esta escala, los microservicios solo añaden coste operativo (ver ADR-07).

**Por qué NestJS y no Express/Fastify a pelo:** pediste capas. NestJS impone módulos, inyección de dependencias y *guards* (justo donde vive la autorización). Se usa con el adaptador **Fastify** por rendimiento.

**Lo que se pierde al no usar Spring Boot (honestidad):**
- Spring Security es más maduro que cualquier cosa de Node en autorización compleja.
- El tipado de Java es más estricto en runtime; en TS hay que validar en los bordes (por eso Zod en cada entrada).
- NestJS abusa de decoradores y "magia"; a veces es más difícil de depurar que Spring.

**Cuándo cambiaría a Spring Boot:** si el cliente dejara de necesitar puntuar offline, o si el proyecto pasara a mantenerse por un equipo Java. Ninguna de las dos aplica hoy.

**Descartados también:** Go (no se comparte código con el front y no lo dominas), .NET (mismo problema), BaaS puro tipo Supabase/Firebase sin backend propio (la puntuación secreta y el versionado del cuestionario acabarían en funciones dispersas; para un proyecto que quiere "hacerse bien", el dominio merece su servicio).

### ADR-03 · Base de datos: PostgreSQL + Drizzle

**Decisión:** PostgreSQL gestionada (Neon, Supabase-DB o similar) y Drizzle ORM.

- Datos claramente relacionales (club → equipo → membresía → intento → respuestas). Postgres además da `jsonb` para el ranking calculado y opciones del cuestionario sin forzar tablas de más.
- **Drizzle** sobre Prisma: está más cerca del SQL, sin motor binario aparte, migraciones en SQL legible. Prisma tiene más tutoriales; se cambia si Drizzle frena.
- Descartado MongoDB: no hay ninguna razón documental; los informes del entrenador son *joins* y agregados.

### ADR-04 · Autenticación: Google OAuth vía Better Auth; autorización propia

**Contexto:** hoy todos los usuarios son mayores de edad y tienen cuenta de Google.

**Decisión:** **Better Auth** gestiona identidad y sesiones con **Google OAuth (OIDC) como único método inicial**. La **autorización** (quién ve qué equipo) es nuestra, en el backend.

- **Solo Google al inicio** elimina de raíz contraseñas propias: nada de hash, reseteos ni fuerza bruta contra nuestra BD. Menos superficie de ataque y menos código. Se pide solo `openid email profile`.
- Se mantiene **Better Auth** (y no OIDC "a pelo" con una librería cliente) porque resuelve sesiones, vinculación de cuentas y añadir proveedores después (email+contraseña, Microsoft, OIDC genérico) sin reescribir nada.
- **¿Por qué no Auth0/Clerk/Firebase Auth?** Funcionarían ahora que todos tienen email. Se descartan por dependencia de un proveedor con precio por usuario activo y datos de identidad fuera de nuestra BD. Si Better Auth fallara en el spike, **Auth0 o Clerk pasan a ser el plan B razonable** (antes lo era Passport a mano; ya no compensa).
- Sesiones por **cookie httpOnly**, no JWT en `localStorage` (robable por XSS y no revocable).
- Coste asumido: quien no tenga cuenta de Google no puede entrar. Hoy no es un problema; si aparece, se activa email+contraseña en Better Auth.
- **Primer spike del proyecto:** Better Auth + NestJS + Google con la cookie compartida entre `app.` y `api.`.

### ADR-05 · Monorepo pnpm

Un repo, tres paquetes que importan, uno de contratos. Despliegues independientes.

### ADR-06 · Offline: "completa offline, resultado oficial al sincronizar"

- El contenido del cuestionario (preguntas de posición **con pesos**) se cachea en el dispositivo.
- El jugador puede responder todo sin conexión; el intento queda en IndexedDB con un `client_attempt_id`.
- Sin conexión, el celular muestra un **podio provisional** calculado con `@sdl/domain`. Al volver la conexión se envía; el servidor puntúa y devuelve el resultado oficial, que es el que cuenta. *(v1 tenía además preparación, que solo se conocía online; se retiró en v2.)*
- Exponer los pesos de posición no es un problema real: la "fakeabilidad" del test viene de que las preguntas son transparentes, no de que alguien lea el código.
- **Los exámenes de conocimiento son solo online.** El servidor sirve las preguntas una vez iniciado el examen, controla el tiempo y nunca envía las correctas; no se pueden cachear sin regalar el banco.

### ADR-07 · Identidad dentro del monolito modular, no como microservicio

**Pregunta planteada:** ¿separar la autenticación en un microservicio para poder enchufar LDAP u OAuth de redes sociales en el futuro?

**Decisión:** **no**. La identidad es un **módulo** (`identity`) del monolito, detrás de un **puerto** `IdentityProvider`. La extensibilidad se consigue con esa abstracción y con protocolos estándar, no separando procesos.

**Por qué no microservicio, siendo críticos:**
- **Lo que hace sustituible la autenticación es el contrato, no el despliegue.** El resto del sistema solo conoce un `userId` interno y una sesión validada. Cambiar Google por LDAP es cambiar la implementación del puerto, esté en otro proceso o no.
- **Añadir Google, Microsoft o GitHub** ya lo da Better Auth como configuración. No exige un servicio aparte.
- **LDAP / Active Directory** (el caso que de verdad podría llegar si un club lo exige) no se integra bien escribiendo un servicio propio: se resuelve poniendo un **broker de identidad estándar** (Keycloak, Entra ID, Authentik) que habla LDAP por un lado y **OIDC** por el otro. Nuestra app solo añade "otro proveedor OIDC". Ese broker *es* el "servicio separado", pero uno maduro que no escribimos ni mantenemos nosotros.
- **Coste real de un microservicio de auth propio** para un desarrollador: dos despliegues, red y latencia en cada petición autenticada, sesiones o tokens que validar entre servicios, consistencia de usuarios entre dos BD, más superficie de ataque y el doble de observabilidad. Todo eso para un beneficio que el puerto ya da.
- **Dónde está la complejidad de verdad:** en la *autorización* (membresías, equipos, quién ve qué) y eso está fuertemente acoplado a los datos de negocio. Sacarla a otro servicio sería peor aún.

**Cómo se mantiene la puerta abierta:**
1. Tabla propia `user` como identidad interna; las identidades externas viven en `account` (proveedor + id externo). Un usuario puede tener varias.
2. Ningún módulo de negocio importa Better Auth: lo hace solo `identity/infrastructure`.
3. El módulo `identity` no comparte tablas con otros salvo `user.id`; si algún día hay que extraerlo, el corte está hecho.

**Cuándo sí extraerlo:** si varias aplicaciones distintas deben compartir login (SSO entre productos), o si un cliente exige su propio IdP. Incluso entonces, la primera opción es adoptar Keycloak/Entra como IdP central, no programar uno.

### ADR-08 · REST + contratos Zod, no GraphQL

**Pregunta planteada:** ¿usar GraphQL?

**Decisión:** **REST** con esquemas Zod en `packages/contracts`. Opcional: `ts-rest` para tener cliente tipado de punta a punta sin generar código.

**Dónde GraphQL brilla y por qué aquí no aplica:**
- Su valor es que **muchos clientes distintos** pidan formas distintas del mismo grafo de datos sin crear endpoints nuevos. Aquí hay **un solo cliente** (la PWA) con pantallas conocidas; cada pantalla tiene su endpoint.
- **Offline y caché:** el cuestionario se cachea en el service worker por URL con `ETag`. GraphQL va casi todo por `POST` a un solo endpoint, y el caché HTTP y del service worker deja de funcionar sin capas extra (persisted queries, caché normalizada).
- **Autorización:** en REST se autoriza por endpoint. En GraphQL hay que autorizar **por campo y por resolver**, porque cualquier consulta puede atravesar el grafo (de un equipo a sus jugadores, y de ahí a sus exámenes). Es justo donde hay datos sensibles (puntajes de conocimiento, notas del entrenador) y donde es fácil equivocarse.
- **Coste operativo:** problema N+1 (requiere DataLoader), límites de profundidad y coste de consultas para evitar abusos, más herramientas.
- **Los tipos compartidos** ya los dan los esquemas Zod compartidos; esa ventaja de GraphQL no se pierde.

**Qué se pierde:** algunas pantallas (perfil del jugador) necesitarán endpoints "agregadores" que junten varias cosas. Se aceptan de forma explícita (`GET /teams/:teamId/players/:userId/profile`).

**Cuándo reconsiderar:** si aparece un segundo cliente con necesidades distintas (app nativa, integración de terceros, un portal de federación) o si los endpoints agregadores empiezan a multiplicarse sin control.

## 3. Capas

### 3.1 Monorepo

```
/
├── apps/
│   ├── web/                 PWA React
│   └── api/                 NestJS
├── packages/
│   ├── domain/              TS puro: puntuación, plegado, certificación,
│   │                        medias por posición, encaje y húngaro
│   ├── contracts/           Esquemas Zod de la API (request/response)
│   └── config/              tsconfig, eslint compartidos
└── docs/                    estos documentos
```

### 3.2 Backend (`apps/api`) — arquitectura hexagonal ligera

```
src/
├── modules/
│   ├── quiz/
│   │   ├── domain/            (re-exporta packages/domain + reglas propias del módulo)
│   │   ├── application/       casos de uso: StartAttempt, SubmitAttempt, RescoreAttempts
│   │   ├── infrastructure/    repositorios Drizzle, mapeadores
│   │   └── http/              controllers, DTO (Zod), guards
│   ├── certification/         exámenes de conocimiento y mejor puntaje (StartExam, SubmitExam, VoidExam)
│   ├── player-profile/        tarjeta 0–99, medias por posición; (futuro) pruebas de campo
│   ├── teams/                 clubs, equipos, membresías, invitaciones
│   ├── assessments/           valoraciones del entrenador
│   ├── lineups/               planificador (encaje multi-fuente + húngaro)
│   ├── questionnaires/        versiones de cuestionario y bancos de certificación (admin)
│   └── identity/              puerto IdentityProvider + adaptador Better Auth/Google, consentimiento de datos
├── shared/
│   ├── authz/                 políticas y guard de autorización
│   ├── db/                    cliente Drizzle, transacciones
│   └── errors/                errores de dominio → HTTP
└── main.ts
```

Reglas de dependencia:
- `http → application → domain`.
- `application` define **puertos** (interfaces de repositorio); `infrastructure` los implementa.
- `domain` no importa NestJS, Drizzle ni nada de I/O.
- La autorización se decide en `application` (¿este usuario puede hacer este caso de uso sobre este equipo?), con un *guard* en `http` como primera barrera.

### 3.3 Frontend (`apps/web`)

```
src/
├── app/            router, providers, registro del service worker
├── features/
│   ├── quiz/       pantallas + hooks del test de orientación
│   ├── certification/ examen, resultado, mis certificaciones
│   ├── player-profile/ tarjeta del jugador, edición por el entrenador
│   ├── history/
│   ├── squad/      panel del entrenador
│   ├── lineup/     planificador
│   ├── team-admin/ invitaciones, miembros
│   └── auth/
├── shared/
│   ├── api/        cliente HTTP tipado con contracts
│   ├── offline/    cola IndexedDB + sincronización
│   ├── ui/         Pitch (único), Button, Card, Table, BarRow
│   └── styles/     tokens de la paleta pizarra
└── main.tsx
```

Organizado **por funcionalidad**, no por tipo de archivo. La lógica de negocio no vive en componentes: componentes → hooks → `shared/api` o `packages/domain`.

## 4. Calidad

- **Tests de dominio de paridad:** antes de refactorizar, se fijan con tests los resultados del prototipo (mismas respuestas → mismo ranking).
- Vitest en `domain`, `contracts` y web; tests de integración del API contra Postgres real en contenedor (Testcontainers).
- Playwright para el flujo crítico: invitar → registrarse → hacer test → entrenador ve resultado.
- CI en GitHub Actions: lint, typecheck, tests, migraciones en seco.

## 5. Despliegue (propuesta, revisar costes al momento)

| Pieza | Dónde |
|---|---|
| PWA estática | Cloudflare Pages / Netlify / Vercel |
| API | Contenedor en Fly.io / Render / Railway |
| Postgres | Neon o Supabase (solo como BD) |
| Dominio | Propio, con `app.` y `api.` |

Entornos: `local` (docker compose con Postgres y Caddy como proxy HTTPS en `app.`/`api.sdl.localtest.me`, ver `04` §1.0), `staging`, `prod`. Secretos en el proveedor, nunca en el repo.
