# 04 · Autenticación, autorización y protección de datos

> Supuesto vigente: **todos los usuarios son mayores de 18 años y tienen cuenta de Google.** Si cambia, ver §5.

---

## 1. Autenticación (quién eres)

- **Método único inicial: "Entrar con Google"** (OIDC), gestionado por Better Auth en `/api/auth/*`, con sesiones en nuestra Postgres.
- Scopes mínimos: `openid email profile`. No se pide acceso a Drive, contactos ni nada más.
- Solo se aceptan cuentas con `email_verified = true` según Google.
- No hay contraseñas propias: nada de hash, reseteos ni bloqueo por fuerza bruta en nuestra BD.
- **Sesión en cookie** `httpOnly`, `Secure`, `SameSite=Lax`, en el dominio padre para que `app.` y `api.` la compartan. Expiración deslizante (p. ej. 30 días), revocable desde "cerrar sesión en todos los dispositivos".
- CSRF: `SameSite` + verificación de cabecera `Origin` en métodos que modifican (`/api/v1/*`: hook `registerOriginCheck`; `/api/auth/*`: Better Auth con `trustedOrigins`, forzado con `disableOriginCheck: false` porque Better Auth lo apaga solo si detecta un entorno de test).
- Cookies con prefijo `sdl` (`__Secure-sdl.session_token`, `__Secure-sdl.state`…), `Domain` = `COOKIE_DOMAIN`.
- **Fase 0:** aún no hay control de invitación; puede entrar cualquier cuenta de Google que esté en los *usuarios de prueba* del cliente OAuth. El alta por invitación (§1.2) llega en Fase 2.

### 1.0 Entorno local (spike de Fase 0)
Google no acepta `*.localhost` como origen ni como redirección, así que en local se usa **`https://app.sdl.localtest.me`** y **`https://api.sdl.localtest.me`** (`*.localtest.me` resuelve a la máquina local por DNS público) detrás de **Caddy** con certificados locales (`docker/caddy/Caddyfile`). La cookie usa `Domain=sdl.localtest.me`, `Secure`, `HttpOnly` y `SameSite=Lax`, igual que en producción. Pasos en el `README.md`.
- **Offline:** la PWA no necesita sesión para responder un test de orientación ya iniciado; sí para enviarlo. Los exámenes de certificación exigen sesión y conexión durante todo el examen.

### 1.1 Extensibilidad (ver ADR-07)
- Todo el negocio usa el `user.id` interno; la identidad externa vive en `account`.
- Añadir otro proveedor social o email+contraseña = configuración de Better Auth.
- LDAP / Active Directory / SSO de un club = un **broker de identidad** (Keycloak, Entra ID…) expuesto como proveedor **OIDC** genérico. No se escribe un microservicio propio.
- **Vinculación de cuentas:** un mismo email llegando por otro proveedor se vincula al usuario existente solo si ambos proveedores verifican el email.

### 1.2 Alta de usuarios
No hay registro abierto. Se entra por **invitación**:
1. El entrenador genera un código (individual o grupal, con caducidad y nº de usos).
2. El jugador abre `app.<dominio>/unirse/<código>` y entra con Google.
3. Acepta la política de datos y **declara ser mayor de 18 años** (`data_consent.age_confirmed`). Si no lo es, no se completa el alta y se le muestra un mensaje (no hay flujo de menores por ahora).
4. Queda como `player` en el equipo.

Los admins de club se crean por script al inicio; ellos crean equipos e invitan entrenadores.

## 2. Autorización (qué puedes hacer)

**Membresías con alcance** (RBAC por club/equipo) + reglas de **propiedad**. Toda decisión en el backend; la UI solo oculta botones.

### 2.1 Roles

| Alcance | Rol |
|---|---|
| Plataforma | `platform_admin` |
| Club | `owner`, `admin` |
| Equipo | `coach`, `assistant`, `player` |

### 2.2 Matriz de permisos

| Acción | player | assistant | coach | club admin | platform admin |
|---|---|---|---|---|---|
| Hacer el test de orientación | ✔ propio | – | – | – | – |
| Hacer examen de conocimiento | ✔ propio | – | – | – | – |
| Ver su historial, resultados y puntajes de conocimiento | ✔ | – | – | – | – |
| Ver su tarjeta 0–99 | ✔ si el equipo lo permite (D8) | – | – | – | – |
| Editar su perfil (nombre, pie, posiciones preferidas) | ✔ | – | – | – | – |
| Ver resultados y preparación del equipo | ✘ | ✔ | ✔ | ✔ (sus equipos) | soporte* |
| Ver conocimiento del equipo | ✔ (banda de compañeros, sin puntaje) | ✔ | ✔ | ✔ | soporte* |
| Ver resultados detallados de otros jugadores | ✘ | ✔ | ✔ | ✔ | soporte* |
| Puntuar la tarjeta 0–99 | ✘ | ✔ | ✔ | ✘ | ✘ |
| Registrar valoración de posición | ✘ | ✔ | ✔ | ✘ | ✘ |
| Anular un intento o examen (motivo obligatorio) | ✘ | ✘ | ✔ | ✔ | ✘ |
| Solicitar re-evaluación de conocimiento (motivo obligatorio) | ✘ | ✘ | ✔ | ✔ | ✘ |
| Ver solicitudes de re-evaluación propias y su motivo | ✔ | – | – | – | – |
| Crear/editar alineaciones | ✘ | ✔ | ✔ | ✘ | ✘ |
| Invitar jugadores | ✘ | ✘ | ✔ | ✔ | ✘ |
| Invitar entrenadores | ✘ | ✘ | ✘ | ✔ | ✘ |
| Quitar miembros / cambiar roles | ✘ | ✘ | jugadores | ✔ | ✘ |
| Importar CSV heredados / exportar datos del equipo | ✘ | ✘ | ✔ | ✔ | ✘ |
| Gestionar cuestionarios y bancos de certificación | ✘ | ✘ | ✘ | ✘ | ✔ |
| Revisar contenido de un banco (sin publicar) | ✘ | ✘ | ✔ si se le asigna como revisor | ✘ | ✔ |

\* Acceso de soporte solo con registro en `audit_log`.

Decisiones de producto: ver D1, D2 y D8 en `06`.

**Cuidado con el revisor de bancos:** un entrenador que revisa un banco conoce las respuestas. No debe examinarse de esa posición mientras sea revisor, y sus jugadores no deben tener acceso a él. Se registra en `audit_log`.

### 2.3 Implementación
- **Guard** global en NestJS: exige sesión salvo rutas `@Public()`.
- Decorador por endpoint: `@Can('team.ratings.write', { teamParam: 'teamId' })`.
- La matriz vive en `apps/api/src/shared/authz/policy.ts` como función pura `can(actor, permiso, { teamId, clubId })`, probada contra esta tabla. `PermissionGuard` (global, después de `SessionGuard`) carga las membresías activas una vez por petición y responde **404** si el equipo no existe o el id no es válido, y **403** si no hay permiso. El caso de uso vuelve a llamar a `can()` antes de responder.
- El admin de plataforma **no** tiene acceso implícito todavía: el acceso de soporte llega junto con `audit_log`.
- Los repositorios **siempre filtran por equipo/usuario autorizado** (defensa en profundidad).
- Opcional más adelante: Row Level Security de Postgres como tercera barrera.
- Por cada endpoint, test de "rol permitido" y de "rol denegado / otro equipo".

## 3. Integridad de los exámenes de conocimiento

- Las opciones correctas y las explicaciones **nunca** se serializan al cliente (tests que lo verifican sobre todos los DTO).
- El servidor elige los ítems, fija `deadline_at` y rechaza respuestas fuera de plazo (con un margen de unos segundos por latencia).
- Solo se aceptan respuestas a ítems servidos en ese examen y opciones de ese ítem.
- Un examen activo por jugador; **un intento por posición cada 30 días**, comprobado en el servidor. Cuenta el **mejor** intento; el límite mensual es lo que impide insistir hasta tener suerte. La única excepción a la espera es una re-evaluación pendiente (o un puntaje "a revisar"), comprobada en el servidor.
- Al final se devuelve puntaje y desglose por área, **no** qué preguntas se fallaron.
- Límite de peticiones en los endpoints de examen para evitar extraer el banco a base de abrir y abandonar exámenes: abandonar se puntúa con lo respondido y consume el intento del mes.
- Lo que **no** se puede evitar: que el jugador consulte a alguien o busque en internet durante el examen. La app lo dice (ver `02`, §6.1).

## 4. Seguridad general

- Validación con Zod de **toda** entrada.
- Cabeceras: CSP estricta en la PWA, HSTS, `X-Content-Type-Options`.
- CORS solo para `app.<dominio>` con credenciales.
- Logs sin datos personales; ids en vez de nombres o emails.
- Escaneo de dependencias (Dependabot / `pnpm audit`).
- Backups diarios de Postgres con prueba de restauración.

## 5. Protección de datos

> No es asesoría legal. Antes de usarlo con equipos reales, conviene una revisión de alguien que conozca la normativa.

Aunque todos sean adultos, en Colombia aplica la **Ley 1581 de 2012**: el tratamiento de datos personales requiere **autorización previa, expresa e informada** del titular, y este tiene derecho a conocer, actualizar, rectificar y suprimir sus datos.

Medidas:
1. **Política de tratamiento** versionada, aceptada al entrar (`data_consent`), que explique para qué se usan los datos: orientación de posición, examen de conocimiento, tarjeta y alineaciones dentro del equipo.
2. **Minimización:** nombre visible, email (viene de Google), foto de perfil de Google **no** se guarda, datos del test, exámenes, tarjeta y valoraciones. Nada de documento de identidad, dirección ni fecha de nacimiento.
3. **La tarjeta 0–99 y las notas del entrenador son datos personales evaluativos:** solo los ve el cuerpo técnico (y el propio jugador si el equipo lo permite). Nunca públicos.
4. **Derechos del titular desde la app:** exportar (`GET /me/export`) y solicitar borrado.
5. **No es un veredicto:** la app lo dice en resultados, tarjeta y puntaje de conocimiento, y el entrenador lo ve al consultarlos.

### 5.1 Si en el futuro entran menores
Se reactiva el diseño previo: año de nacimiento, flujo de **autorización del representante legal** (régimen reforzado para niños, niñas y adolescentes), cuentas sin email (usuario y contraseña creados por invitación) y bloqueo de sincronización sin autorización vigente. No es un cambio menor: implica activar un método de login adicional en Better Auth y nuevas tablas. Debe pasar por revisión legal antes.
