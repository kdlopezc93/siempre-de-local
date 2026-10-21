# Spike PWA · instalación, caché del cuestionario y cola offline

> Fase 0 (`06-roadmap.md`). Valida ADR-06 en celulares reales antes de construir el test de orientación.
> **Código temporal:** módulo `apps/api/src/modules/spike-pwa`, `packages/contracts/src/spike-pwa.ts`, `apps/web/src/features/spike-pwa` y la ruta `/prueba-pwa`. Se borran en Fase 3, cuando existan `GET /questionnaires/current` y `POST /attempts`.
> **Se queda:** `apps/web/src/shared/offline/` (cola en IndexedDB y caché del API), el caché del service worker para `/me` y la sesión con `networkMode: 'offlineFirst'`.

## Qué se prueba

1. **Instalación** en Android (Chrome) y iPhone (Safari → Compartir → Agregar a inicio).
2. **Login con Google dentro de la app instalada**, sobre todo en iPhone: la app instalada tiene sus propias cookies, separadas de Safari, y el login sale a `accounts.google.com` y vuelve.
3. **Cuestionario sin conexión:** abierto una vez con red, la app instalada lo muestra en modo avión.
4. **Cola offline:** respuestas guardadas en modo avión quedan "Pendiente" (también tras cerrar y abrir la app) y se envían solas al volver la red, sin duplicarse.

## Cómo levantarlo

Todo va por **un solo origen HTTPS** (túnel → `vite preview` en `:4173`, que reenvía `/api` al API en `:3000`). Así la cookie de sesión es de primera parte también en el túnel, donde `app.` y `api.` no existen.

1. `pnpm db:up` (Postgres local).
2. En VS Code (ventana conectada a WSL) → panel **Puertos** → **Reenviar un puerto** → `4173`. Clic derecho → **Visibilidad del puerto → Pública**. Copia la URL (`https://<id>-4173.<región>.devtunnels.ms`). La URL se mantiene mientras no borres el reenvío.
3. Google Cloud Console → Google Auth Platform → Clientes → el cliente web de desarrollo:
   - **Orígenes de JavaScript autorizados:** la URL del túnel.
   - **URI de redirección autorizados:** `<URL del túnel>/api/auth/callback/google`.
4. `pnpm spike:pwa <URL del túnel>` — compila contracts, API y la web en modo spike, y levanta el API y `vite preview`.
5. En el celular abre `<URL del túnel>/prueba-pwa`. La primera vez el túnel muestra un aviso de Microsoft: toca **Continuar**.

No hace falta tocar `apps/api/.env`: el script sobrescribe `BETTER_AUTH_URL`, `WEB_ORIGIN` y `COOKIE_DOMAIN` solo para ese proceso.

## Guion en cada celular

| # | Paso | Esperado |
|---|---|---|
| 1 | Abrir `/prueba-pwa` en el navegador, entrar con Google | Vuelve a la pantalla de prueba con sesión |
| 2 | Instalar (Android: menú → Instalar app; iPhone: Compartir → Agregar a inicio) | Ícono "De Local" en el inicio |
| 3 | Abrir desde el ícono | "Abierta como: App instalada". En iPhone probablemente pida entrar otra vez (cookies separadas) |
| 4 | Si pide login: entrar con Google desde la app instalada | Vuelve **a la app instalada** con sesión, no a Safari/Chrome |
| 5 | Con red, ver el cuestionario. Activar **modo avión**, cerrar la app del todo y abrirla | Abre, muestra la sesión y el cuestionario |
| 6 | En modo avión, responder y **Guardar** dos veces | Dos envíos "Pendiente"; mensaje "Sin red…" |
| 7 | Cerrar la app, abrirla (aún sin red) | Los dos siguen "Pendiente" |
| 8 | Quitar modo avión y volver a la app | Pasan a "Enviado" solos (o con **Enviar pendientes**) |
| 9 | **Enviar pendientes** otra vez | Nada cambia; el servidor no duplica |
| 10 | Revisar "Datos protegidos" | Android: "Sí" tras el primer envío (si el navegador lo concede). iPhone: anotar |

## Resultados

| Paso | Android · Samsung SM-S938B (Galaxy S25 Ultra), Android 16, Chrome 155 | iPhone (modelo / iOS) |
|---|---|---|
| 1 Login en navegador | ✅ | |
| 2 Instalación | ✅ | |
| 3 Abrir instalada | ✅ "App instalada", service worker activo | |
| 4 Login en instalada | ✅ | |
| 5 Abrir sin red | ✅ Sesión y cuestionario tras cerrar la app del todo | |
| 6–7 Cola sin red | ✅ Pendientes sobreviven a cerrar y abrir la app | |
| 8 Sincroniza al volver | ✅ Guardados 10:55 p. m., enviados 10:56 p. m. al volver la red | |
| 9 Sin duplicados | ✅ | |
| 10 Datos protegidos | ✅ "Sí" en la app instalada | |
| Extra: cerrar sesión en todos | ✅ Desde el celular, la PC también vuelve a /entrar | |

## Lo que ya salió al construirlo

Hallazgos de implementación, antes de probar en celulares:

- **TanStack Query no lanza consultas sin red** (`networkMode: 'online'` por defecto): sin red, la sesión se quedaba en "Cargando…" para siempre aunque el service worker tuviera copia. La sesión y el cuestionario usan `networkMode: 'offlineFirst'`.
- **La sesión también tiene que estar en caché**, no solo el cuestionario: sin `/me` la app instalada no pasa de la puerta. El service worker guarda `/me` y el cuestionario con `NetworkFirst` (4 s de espera; con red siempre manda el servidor). **Al cerrar sesión se borra ese caché.**
- **La cola es por usuario.** Si alguien cierra sesión con envíos pendientes y entra otro, los pendientes del primero no se mandan con la sesión del segundo; esperan a que vuelva su dueño.
- **Background Sync no existe en iOS:** la cola se vacía al abrir la app, al volver la red (`online`) y al volver a la app (`visibilitychange`). Un vaciado a la vez, también entre pestañas (Web Locks).
- **Errores:** sin red, 5xx, 408 o 429 → sigue pendiente y se para (no se reordenan envíos); 401 → pendiente, hay que volver a entrar; otro 4xx → "Rechazado" y sigue con el resto.
- **Con el API en el mismo origen**, el service worker respondía `index.html` a la vuelta de Google (`/api/auth/callback/google`). Se excluye `/api/` del fallback de navegación.
- **El túnel de VS Code reescribe `Origin`** de su URL pública a `http://localhost:4173`, y Better Auth respondía 403 `INVALID_ORIGIN` al cerrar sesión. El proxy de `vite preview` devuelve ese valor al origen público (`SPIKE_PUBLIC_ORIGIN`); los demás orígenes pasan tal cual y se siguen rechazando. Solo afecta al túnel: en staging y producción no hay reescritura.
- **Las rutas de `runtimeCaching` se copian tal cual al service worker:** no pueden usar variables de `vite.config.ts`.
- **iOS borra IndexedDB y caché de webs no instaladas tras 7 días sin uso.** Instalada no aplica; además se pide `navigator.storage.persist()` al guardar el primer envío.

## Conclusión

**Android: validado** (2026-10-21). Instalación, login dentro de la app instalada, apertura sin red, cola que sobrevive a cerrar la app, sincronización al volver la red sin duplicados y almacenamiento persistente concedido. ADR-06 se sostiene tal cual en Android.

**iPhone: pendiente** por falta de dispositivo. Es el riesgo abierto: login con Google desde la app instalada (cookies separadas de Safari) y apertura sin red. Repetir el guion con `pnpm spike:pwa <url-túnel>` antes de la Fase 3, cuando el test de orientación empiece a depender de la cola offline. Si el login falla en iOS, la alternativa a evaluar es iniciar sesión en Safari antes de instalar o un enlace de login de un solo uso hacia la app instalada.
