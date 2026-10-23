# Experiencia: auditoría y nueva estructura (Fase 6)

Fecha: 2026-10-22. Parte de las capturas y comentarios de Kevin (entrenador, jugador y dueño del club a la vez) sobre la app al cierre de la Fase 5.

## 1. Qué dijo el equipo

- **"No encuentro las cosas."** Es lo más grave.
- Hay cosas que gustan (la tarjeta, el planificador, el examen), pero **otras se ven feas y anticuadas**.
- **Hay mucho texto.**
- Pide un **cambio fuerte**.

## 2. Hallazgos

| # | Dónde | Qué pasa | Gravedad |
|---|---|---|---|
| H1 | Toda la app | No hay navegación general: cada pantalla tiene su "Volver a…" y todo pasa por el inicio. Las alineaciones guardadas y el informe de validación solo se alcanzan desde otras pantallas | Alta |
| H2 | Toda la app | **En ningún lado se ve claramente a qué equipo perteneces.** El equipo aparece como una caja más del inicio | Alta |
| H3 | Inicio | Es la pantalla provisional de la Fase 0: "muy pronto vas a poder hacer tu test" (ya existe), tu correo, una lista plana de enlaces iguales y, lo más grande, cerrar sesión. No dice qué hay pendiente | Alta |
| H4 | Inicio, test | "Hacer mi test de posición" se ve igual de fácil antes y después de hacerlo. Una vez hecho, lo que importa es su resultado; repetirlo es secundario | Media |
| H5 | Plantilla | Abruma: arriba, botones que no son de la plantilla (armar alineación, informe); después la pizarra de reparto con 3 vistas; después la lista | Alta |
| H6 | Plantilla | La lista es muy larga: cada jugador es una tarjeta de 5 filas de texto con 2 botones | Alta |
| H7 | Plantilla | Tres caminos confusos al mismo jugador: el nombre (perfil), "Ver tarjeta" y "Valorar" o "Volver a valorar" | Alta |
| H8 | Invitar | Queda suelto en el inicio, sin relación con el equipo al que se invita | Media |
| H9 | Perfil, tarjeta | El perfil (cómo te dicen, preferidas) y la tarjeta son dos pantallas sin relación, aunque las dos son "yo como jugador" | Media |
| H10 | Conocimiento | El examen gusta, pero es una pantalla suelta, sin conexión con tu posición ni con tu tarjeta | Media |
| H11 | Toda la app | Exceso de texto: párrafos de explicación en cada pantalla, notas al pie, etiquetas largas ("Cerrar sesión en todos tus dispositivos") | Media |
| H12 | Toda la app | La estética se siente de formulario: cajas con borde, enlaces subrayados, botones de contorno. La identidad "pizarra" solo vive en la cancha y la tarjeta | Media |

## 3. Principios para la Fase 6

1. **El equipo es el contexto.** Arriba se ve siempre en qué equipo estás. Si estás en más de uno, lo cambias desde ahí.
2. **Barra inferior según tu rol.** Nada importante a más de dos toques.
3. **El inicio responde "¿qué hago ahora?"** Muestra pendientes y novedades, no un menú.
4. **Un jugador = una ficha.** Tarjeta, posición, conocimiento y valoración en un solo lugar, para ti y para el cuerpo técnico.
5. **Una línea, no un párrafo.** Las explicaciones van detrás de un "¿Por qué?" o "?" que se abre en una hoja inferior; en pantalla quedan la cifra y el verbo.
6. **Pizarra en todo, no solo en la cancha.** Cambio visual fuerte, conservando lo que gusta (tarjeta, cancha, ámbar), con sistema de diseño v2.
7. **Contraste verificado.** Cada pareja de colores del sistema v2 se mide con WCAG 2.2: AA como mínimo (4,5:1 en texto, 3:1 en texto grande, iconos y bordes de controles). Lo que no pase no entra, tampoco en estados (deshabilitado, foco, error) ni en la tarjeta.
8. **Solo lo que se puede respaldar.** Ninguna frase promete lo que la app no mide o no puede sostener. Cada afirmación (de exactitud, de "basado en ciencia", de tiempos o de resultados) se cita con su fuente en `02` o en "En qué se basa", o se suaviza o se quita.
9. **Tus datos a la vista.** Siempre hay un camino claro para pedir que borren tus datos.

### 3.1 Se conserva

- **El icono de la app** (`apps/web/public/favicon.svg` y los de la PWA): no se toca.
- **Las animaciones al iniciar sesión** (entrada y subrayado de tiza): se mantienen tal cual y sirven de referencia de tono para el movimiento del resto.
- La tarjeta 0–99, la cancha del planificador y el ámbar como acento.

## 4. Nueva estructura

### 4.1 Encabezado de equipo (en todas las pantallas con equipo)

Escudo con iniciales, nombre del equipo, club y formato. Al tocarlo, la lista de tus equipos y tus roles en cada uno.

### 4.2 Barra inferior

| Rol en el equipo activo | Pestañas |
|---|---|
| Solo jugador | **Inicio** · **Mi juego** · **Equipo** |
| Cuerpo técnico (coach o assistant) | **Inicio** · **Plantilla** · **Alineaciones** · **Equipo** |
| Las dos cosas (como Kevin) | **Inicio** · **Plantilla** · **Alineaciones** · **Mi juego** · **Equipo** |
| Admin del club sin rol en el equipo | **Inicio** · **Plantilla** · **Equipo** |

Las pantallas de tarea (test, examen, puntuar, valorar) ocupan la pantalla completa, sin barra, con "cerrar" arriba.

### 4.3 Qué va en cada pestaña

- **Inicio:** tarjetas de "lo que toca", según el rol.
  - Jugador: haz tu test, tu entrenador te pidió re-evaluación, ya puedes repetir el examen, te pusieron tarjeta nueva.
  - Cuerpo técnico: N sin valorar, N sin test, N re-evaluaciones vencidas, la última alineación.
  - Cuando no hay nada pendiente, un resumen corto del equipo.
- **Mi juego** (reemplaza a "Ver mi tarjeta", "Tus tests", "Examen de conocimiento" y "Tu perfil"):
  - arriba, la **tarjeta**;
  - debajo, **tu posición** (el podio del último test), con "repetir el test" discreto;
  - **conocimiento** por posición, con el acceso al examen;
  - el historial;
  - **"Editar mi perfil"** (cómo te dicen, preferidas).
- **Plantilla:**
  - **lista compacta**: una fila por jugador con dorsal, nombre, posición, media de la tarjeta e iconos de lo que falta (sin valorar, sin test);
  - búsqueda y filtros (por posición, "sin valorar", "sin test");
  - la pizarra de reparto pasa a ser **una vista alternativa** (Lista | Pizarra), no un bloque antes de la lista;
  - al tocar un jugador se abre **su ficha**.
- **Ficha del jugador** (cuerpo técnico): tarjeta arriba y debajo Resumen (test, valoración, preferidas), Tarjeta y Conocimiento. Las acciones van en un solo lugar: **Valorar**, **Puntuar tarjeta** y **Re-evaluación**.
- **Alineaciones:** la lista de guardadas, con "Armar nueva" como acción principal.
- **Equipo:**
  - datos del equipo;
  - integrantes por rol;
  - **Invitar** (aquí, asociado al equipo);
  - **Informe de validación**;
  - "En qué se basa el test".
- **Tu cuenta** (`/cuenta`, fuera de las pestañas): se llega desde **tu ficha, arriba a la derecha del encabezado**, en todas las pantallas. Es de ti como persona, igual en todos tus equipos; por eso no va en Equipo (que cambia con el equipo) ni en Mi juego (que un asistente que no juega no tiene). Decidido con Kevin el 2026-10-22.
  - Tu nombre, tu correo y "Editar mi perfil".
  - **Tus equipos con tu rol en cada uno y lo que te permite**, y los clubes que administras. Es copia de la matriz del API (`policy.ts`), que es la que decide.
  - **Tus datos:** descargar y eliminar (§4.5).
  - **Cerrar sesión**, en este celular o en todos tus dispositivos (en una hoja).
  - Separado de la navegación principal, como piden las guías de `ui-ux-pro-max` para salir y borrar la cuenta.

### 4.4 Qué se quita

- Del inicio: el correo, el "muy pronto", la lista de enlaces y los botones de cerrar sesión (pasan a "Tu cuenta").
- De la plantilla: los botones "Armar la alineación" e "Informe de validación" (tienen su lugar en la barra o en Equipo).
- Los "Volver a…" donde la barra ya lleva.

### 4.5 Eliminación de datos

- **Enlace "Eliminar mis datos"** en Tu cuenta, en la pantalla de entrar y en la política de tratamiento.
- Lleva a una **página pública** (`/tus-datos`, sin sesión) que explica qué se borra, qué se conserva de forma anónima y en cuánto tiempo, y cómo pedirlo. Google la exige para publicar el inicio de sesión con Google.
- Con sesión, **"Eliminar mi cuenta"** desde la app, con confirmación. Borra o anonimiza según `04-auth-seguridad.md` §5 y la política, y cierra todas las sesiones.
- Al lado, **"Descargar mis datos"** (`GET /me/export`, ya previsto en `04` §5).
- Los plazos y el correo de contacto vienen de la política, que sigue pendiente de revisión legal (D7): sin esos datos no se publica con equipos reales.

### 4.6 Datos del equipo

En **Equipo → Datos del equipo** (coach y admin del club; el resto lo ve sin editar):

- **Nombre** del equipo.
- **Formatos en que juega:** Fútbol 11, Fútbol 8 o los dos (como el equipo de Kevin). Si son los dos, se elige el **principal**.
- Temporada, y la visibilidad de la tarjeta para los jugadores (hoy ya existe en la API, `ratingsVisibleToPlayers`).

Varios formatos cambian el modelo: hoy `team.format` es uno solo y lo usan el test (plegado F8), las posiciones que se valoran, la tarjeta y el planificador (que ya deja elegir el formato por partido). Pasa a `team.formats` + `primaryFormat`, con migración y nota en `03-modelo-datos.md`. Qué formato usa cada cosa queda como decisión **D14** en el roadmap.

### 4.7 Fotos del jugador y del equipo

- **Foto del jugador** (la sube él, desde Mi juego → Editar mi perfil) y **escudo o foto del equipo** (coach y admin del club, desde Datos del equipo).
- Reemplazan las iniciales en el disco de la ficha y en el escudo del encabezado. Sin foto, se siguen viendo el dorsal o las iniciales.
- **En el celular, antes de subir:** recorte cuadrado, reducción a ~512 px en WebP y **sin metadatos** (EXIF, ubicación GPS).
- **Privacidad:** una foto de la cara es un dato personal. Hoy la política dice que no guardamos fotos (`04` §5, minimización), así que hace falta:
  - actualizar la política y pedir la aceptación otra vez;
  - que la foto sea opcional y que la vea solo el equipo;
  - que se pueda quitar en cualquier momento y se borre con la cuenta (§4.5).
- **Almacenamiento:** objetos fuera de la base, en Cloudflare R2, en línea con el hosting de D5. Las fotos se sirven desde el mismo dominio, con la CSP de §4.8 limitando `img-src`. La elección queda como decisión **D15**.

### 4.8 Terceros

Hoy la web no carga nada de terceros: las fuentes van empaquetadas (Fontsource), no hay analítica ni scripts externos, y el único servicio de afuera es Google para entrar. La auditoría lo deja por escrito y lo vigila:

- inventario de dependencias de web y API (qué hace cada una, si sale a la red, qué datos toca y su licencia) en `04-auth-seguridad.md`;
- `pnpm audit` sin vulnerabilidades altas ni críticas;
- revisar los permisos y datos que se piden a Google (solo nombre y correo);
- una **política de seguridad de contenido (CSP)** que impida cargar scripts, fuentes o imágenes de otros orígenes sin decidirlo;
- regla para lo que venga (analítica, errores): no entra sin pasar por este inventario y por la política de datos.

## 5. Plan en PRs


| # | PR | Cubre |
|---|---|---|
| 1 | Este documento y el roadmap | — |
| 2 | **Sistema de diseño v2** (skill `ui-ux-pro-max` + `frontend-design`): tokens, tipografía, superficies, lista, chips, hoja inferior, encabezado y barra, con **contraste verificado** de cada pareja (principio 7). Conserva el icono y las animaciones de entrar (§3.1). En `docs/design-system.md` | H12 |
| 3 | **Armazón:** encabezado de equipo con selector, barra inferior por rol, pantallas de tarea a pantalla completa, rutas nuevas (`/equipos/:id/…` como base) | H1, H2 |
| 4 | **Inicio "lo que toca"** (endpoint de pendientes por rol) | H3, H4 |
| 5 | **Plantilla:** lista compacta, búsqueda, filtros y vista Pizarra | H5, H6 |
| 6 | **Ficha del jugador** para el cuerpo técnico: une perfil, tarjeta, valorar y conocimiento | H7 |
| 7 | **Mi juego:** tarjeta, posición, conocimiento, historial y editar perfil en una pestaña; el test deja de ser un enlace suelto | H4, H9, H10 |
| 8 | **Equipo:** datos del equipo (nombre, formatos en que juega, principal; §4.6, con migración), integrantes, invitar, informe y cuenta | H2, H8 |
| 9 | **Fotos** del jugador y del equipo (§4.7): subida con recorte, reducción y sin metadatos, almacenamiento, política actualizada | — |
| 10 | **Tus datos:** página pública `/tus-datos`, enlaces "Eliminar mis datos", eliminar mi cuenta y descargar mis datos (§4.5) | Principio 9 |
| 11 | **Dieta de texto y afirmaciones** en toda la app y en "En qué se basa": explicaciones en hojas "¿Por qué?", y cada afirmación respaldada, suavizada o quitada (principio 8) | H11 |
| 12 | **Auditoría final:** `web-design-guidelines` y `vercel-react-best-practices`; **terceros** (§4.8: inventario, `pnpm audit`, CSP); contraste de nuevo sobre las pantallas reales; prueba completa por rol en el celular | — |

Cada PR se prueba en el celular como siempre. Los PR 2 y 3 cambian todo el aspecto a la vez; desde el 4, una pestaña por PR.
