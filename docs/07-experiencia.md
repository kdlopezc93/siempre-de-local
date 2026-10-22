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
  - "En qué se basa el test";
  - la cuenta: cerrar sesión, privacidad.

### 4.4 Qué se quita

- Del inicio: el correo, el "muy pronto", la lista de enlaces y los botones de cerrar sesión (pasan a Equipo, en "Tu cuenta").
- De la plantilla: los botones "Armar la alineación" e "Informe de validación" (tienen su lugar en la barra o en Equipo).
- Los "Volver a…" donde la barra ya lleva.

## 5. Plan en PRs

| # | PR | Cubre |
|---|---|---|
| 1 | Este documento y el roadmap | — |
| 2 | **Sistema de diseño v2** (skill `ui-ux-pro-max` + `frontend-design`): tokens, tipografía, superficies, lista, chips, hoja inferior, encabezado, barra; `docs/design-system.md` | H12 |
| 3 | **Armazón:** encabezado de equipo con selector, barra inferior por rol, pantallas de tarea a pantalla completa, rutas nuevas (`/equipos/:id/…` como base) | H1, H2 |
| 4 | **Inicio "lo que toca"** (endpoint de pendientes por rol) | H3, H4 |
| 5 | **Plantilla:** lista compacta, búsqueda, filtros y vista Pizarra | H5, H6 |
| 6 | **Ficha del jugador** para el cuerpo técnico: une perfil, tarjeta, valorar y conocimiento | H7 |
| 7 | **Mi juego:** tarjeta, posición, conocimiento, historial y editar perfil en una pestaña; el test deja de ser un enlace suelto | H4, H9, H10 |
| 8 | **Equipo:** datos, integrantes, invitar, informe y cuenta | H2, H8 |
| 9 | **Dieta de texto** en las pantallas que no se rehicieron (test, examen, resultados, planificador): explicaciones en hojas "¿Por qué?" | H11 |
| 10 | **Auditoría final** (`web-design-guidelines` y `vercel-react-best-practices`) y prueba completa por rol en el celular | — |

Cada PR se prueba en el celular como siempre. Los PR 2 y 3 cambian todo el aspecto a la vez; desde el 4, una pestaña por PR.
