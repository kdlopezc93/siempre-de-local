# Sistema de diseño v3: "Escuelas Deportivas"

> Fuente de verdad visual de la PWA. Cada pantalla nueva consulta este documento; no se inventan colores ni tamaños sueltos (CLAUDE.md · Flujo de diseño). Tokens en `apps/web/src/shared/styles/tokens.css`.
>
> **v3 (2026-10-27):** Kevin decidió que la identidad v2 "Pizarra táctica" (verde oscuro, ámbar, Barlow Condensed en mayúsculas, aros de tiza) **se veía hecha con IA**: encontró un video de Instagram editado con IA con una identidad casi idéntica. Se adopta el design system **"Escuelas Deportivas"** que hizo un amigo diseñador de Kevin para la visión de ecosistema (`08-ecosistema.md` §9). Original, con sus 26 componentes de referencia y la maqueta de app: `https://claude.ai/artifact/9D5UCbUAS6p4iFaT7KwiFt`. Este documento lo traduce a la app y le completa lo que no traía: **modo oscuro**, los **tres registros de voz**, **coma decimal**, todo **servido desde la app** (sin CDN) y las reglas para **menores**.
>
> Ojo con las herramientas: para "deportes", `ui-ux-pro-max` recomienda Barlow Condensed + Barlow, justo la elección genérica que hacía ver la v2 como de IA. No volver a ella.

---

## 1. Idea

Una app deportiva **clara, moderna y con energía**: lienzo gris frío, tarjetas blancas, **un bloque de color protagonista por pantalla** (cobalto) y el **volt** como chispa de energía. Las cifras mandan. Las canchas son el único dibujo permitido, con proporciones reales y para varios deportes.

- **Una cosa fuerte por pantalla:** el bloque cobalto (en el inicio, "lo que toca"; en la ficha, la media). Lo demás, tarjetas blancas tranquilas.
- **Los números primero:** la cifra en Space Grotesk y el texto la acompaña ("4,5 / 6 h", "88,5 %").
- **Títulos de dos pesos:** una línea liviana de contexto y el tema en negrita ("Hola, Kevin / **Tu equipo**"); los nombres con el apellido en negrita.
- **Para el celular, en la cancha:** contraste alto, objetivos táctiles grandes, una columna y la barra de abajo al alcance del pulgar.
- **Multideporte:** el núcleo, lo administrativo y la evaluación física no suponen fútbol (decisión 3 de `08`); la paleta por deporte y la cancha dibujada lo permiten.

## 2. Modo de color

**Claro por defecto y oscuro con el sistema del celular** (`prefers-color-scheme`), o forzado con `data-theme="dark"` / `"light"` en `<html>`. Los roles se redefinen en los dos bloques (`@media` y `[data-theme]`) para que cualquiera gane en ambos sentidos. `<meta name="color-scheme" content="light dark">` y dos `theme-color` (claro `#f5f6f8`, oscuro `#0d0f14`). El manifiesto de la PWA admite un solo color: el claro.

**El oscuro lo diseñamos nosotros** (el sistema original solo trae claro), con la misma tinta y el cobalto aclarado para texto:

- Lienzo `night-950 #0d0f14`, tarjeta `night-900 #171a22`, elevado `night-800 #232835`, bordes `night-700 #2f3545`.
- Texto `fog-50 #f2f4f8` y atenuado `fog-300 #a3aab9`.
- `--sdl-primary` (texto, enlaces, foco) pasa a `cobalt-300 #8fa4f5`; el **relleno de marca** (`--sdl-brand`: bloque protagonista y botón principal) sigue siendo cobalto intenso `#3155e8` con texto blanco.
- Las sombras se vuelven un filo de 1px (`night-700`): en oscuro la profundidad es por tono, no por sombra.
- Volt, la paleta por deporte y la tinta sobre volt no cambian.

## 3. Color

### 3.1 Paleta base

| Token | Hex | Uso |
|---|---|---|
| `ink-900` | `#14161c` | Texto; la barra de abajo; tarjetas oscuras; botones de "comprometer" (pagar, confirmar) |
| `ink-700` | `#2e323d` | Detalle sobre cobalto aclarado (oscuro) |
| `ink-500` | `#5f6573` | Texto secundario (el original usa `#6b7180`; se oscureció para pasar 4,5:1 sobre lo seleccionado) |
| `ink-400` | `#7f8592` | Borde de controles (≥ 3:1) |
| `ink-300` / `200` / `100` / `50` | `#c9cdd4` / `#e4e6ea` / `#eef0f3` / `#f5f6f8` | Etiquetas de la barra / divisores / seleccionado y hundido / lienzo |
| `cobalt-500` | `#3155e8` | **Primario**: botón principal, bloque protagonista, pestañas, foco, enlaces |
| `cobalt-600` | `#2440c4` | Cobalto presionado |
| `cobalt-300` / `200` / `100` | `#8fa4f5` / `#a9baf8` / `#e3e9fd` | Primario en oscuro / su hover / detalle sobre cobalto |
| `volt-500` | `#d4f34a` | **Energía**: pestaña activa, rachas, lo destacado sobre la cancha. Texto encima: siempre tinta |
| `volt-600` | `#b8da25` | Volt presionado |
| `sun-500`, `coral-500`, `aqua-500`, `lilac-500`, `orange-500` | | Paleta por deporte y tarjetas de color (texto encima: tinta) |
| `grass-600` | `#2a7356` | Aro de los medios (claro) |
| `attack-600` / `attack-300` | `#c93d28` / `#ff8b7a` | Aro de los delanteros y cruz de lesionado (claro / oscuro) |
| `success-700` / `success-300` | `#0f7443` / `#4fd18f` | Éxito como texto (claro / oscuro). El `success-500` del original (`#1fa866`) no llega a 4,5:1 como texto |
| `danger-600` / `danger-300` | `#c81d33` / `#ff7b88` | Peligro y error (claro / oscuro) |
| `field` / `field-dark` | `#2b733b` / `#245c30` | El pasto de la cancha. Más oscuro que el `#4caf50` del original, para que las líneas y nombres blancos lleguen a 4,5:1 |

### 3.2 Roles semánticos

Los componentes usan **roles**, nunca la paleta ni un hex: `--sdl-bg`, `--sdl-fg`, `--sdl-fg-muted`, `--sdl-surface`, `--sdl-surface-hover`, `--sdl-surface-selected`, `--sdl-surface-raised`, `--sdl-border`, `--sdl-border-control`, `--sdl-primary` (+ `-hover`), `--sdl-on-primary` (+ `-muted`), **`--sdl-brand`** (+ `-hover`, `--sdl-on-brand`, `-muted`), **`--sdl-accent`** (+ `-hover`, `--sdl-on-accent`), **`--sdl-inverse`** (+ `--sdl-on-inverse`, `-muted`), `--sdl-focus-ring`, `--sdl-success`, `--sdl-info`, `--sdl-danger`, `--sdl-danger-fg`, `--sdl-on-danger`, `--sdl-scrim`, la cancha (**`--sdl-field`**, `--sdl-field-stripe`, **`--sdl-on-field`**, **`--sdl-field-accent`**, `--sdl-on-field-accent`, `--sdl-pitch-stroke`) y `--sdl-line-portero|defensa|medio|ataque`, `--sdl-injured`.

- **`--sdl-primary` vs `--sdl-brand`:** primary sirve de texto y de relleno (en oscuro se aclara); brand es solo relleno (el bloque protagonista, el botón principal y el escudo del equipo) y es cobalto intenso en los dos temas.
- **Sobre el pasto, lo destacado va en volt** (`--sdl-field-accent`), no en cobalto: el cobalto casi no se distingue del verde.
- **Estado = color + palabra:** "Al día", "Pendiente", "Vencido"; nunca solo el color.

### 3.3 Contraste verificado (WCAG 2.2)

Lo vigila `src/shared/styles/contrast.test.ts` en **los dos temas**: todo el texto (fg, atenuado, primary, éxito, peligro) ≥ 4,5:1 sobre lienzo, tarjeta y seleccionado; bordes de controles, aros de las fichas y foco ≥ 3:1; y las parejas especiales (blanco y `cobalt-100` sobre cobalto, tinta sobre volt, las pestañas sobre la barra de tinta, el botón de eliminar, blanco y volt sobre el pasto). Si alguien cambia un color y baja del mínimo, el test falla.

Del original, **no se usan como texto**: `ink-400` (2,6:1, solo bordes), `success-500` y `warning-500` (como relleno detrás de texto de tinta, o sobre su tinte `-100`), y el volt sobre blanco.

## 4. Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Interfaz | **Plus Jakarta Sans** (500 texto, 600–700 títulos y botones, 800 títulos de pantalla) | Todo lo que se lee |
| Cifras | **Space Grotesk** (500–700), `tabular-nums` | Medias, goles, conteos, dorsales, relojes |

**Autoalojadas** con `@fontsource` (solo latin): funcionan sin conexión y no dependen de Google Fonts.

| Token | Valor | Uso |
|---|---|---|
| `--sdl-font-display` / `--sdl-font-body` | Plus Jakarta Sans | Títulos / texto |
| `--sdl-font-numeric` | Space Grotesk | Toda cifra |
| `--sdl-text-eyebrow` | 11px | Sobretítulos e insignias (700, `--sdl-tracking-eyebrow`, mayúsculas) |
| `--sdl-text-xs` | 12px | Metadatos cortos, ejes |
| `--sdl-text-sm` | 14px | Metadatos, pistas |
| `--sdl-text-base` | 16px | Texto e inputs (evita el zoom de iOS) |
| `--sdl-text-lg` | 17px | Botón principal, títulos de fila |
| `--sdl-text-xl` | clamp(21px, 5.6vw, 24px) | Títulos de bloque, de hoja y de pregunta |
| `--sdl-text-display` | clamp(28px, 8vw, 36px) | Título de pantalla (800, `-0.02em`) |
| `--sdl-text-number` | clamp(44px, 13vw, 64px) | La cifra protagonista |

- **Tipo oración** en títulos y botones ("Registrar desempeño", "Tomar asistencia"). **Mayúsculas solo en insignias y sobretítulos** (11px, 700, `0.08em`): "EN VIVO", "ENTRENAMIENTO DE HOY".
- Altura de línea 1.5 en texto y 1.1 en títulos.
- **Porcentajes:** con `percent()` de `shared/format.ts` (entero y espacio duro antes del %: "82 %"); nunca se arman a mano.
- **Coma decimal** y punto de miles, como en Colombia: "4,5 h", "$28.440.000", "88,5 %" (con espacio antes del % en el detalle).

## 5. Espaciado, radios, forma y sombras

**Escala de 4px**: `--sdl-space-1` (4) a `--sdl-space-14` (56). Gutter de pantalla `--sdl-gutter` 20px; entre tarjetas 12px; padding de tarjeta 20px.

| Token | Valor | Uso |
|---|---|---|
| `--sdl-radius-sm` | 12px | Inputs, casillas, iconos en recuadro |
| `--sdl-radius-md` | 16px | Mosaicos chicos |
| `--sdl-radius-lg` | 22px | Filas de tarea, cifras, la pizarra del examen |
| `--sdl-radius-xl` | 28px | Tarjetas y el bloque protagonista |
| `--sdl-radius-2xl` | 32px | Hojas inferiores |
| `--sdl-radius-pill` | 999px | Botones, chips, insignias, la barra de abajo |

- **Tarjetas:** `--sdl-surface`, `radius-xl`, `--sdl-shadow-card`, sin borde. Las de color van planas, salvo el bloque cobalto (`--sdl-shadow-brand`). **Nunca** un borde de color a la izquierda.
- **Listas:** filas separadas y redondeadas con 8px entre ellas; los detalles clave/valor con divisores punteados de 1px.
- **Sombras:** `--sdl-shadow-card` → `-raised` → `-float`, tinta con poca opacidad. Brillo de color solo bajo cobalto. En oscuro, un filo de 1px.
- **Fondos planos:** sin degradados, texturas ni patrones (el pasto con franjas es la excepción: es la cancha).
- **Armazón:** encabezado de equipo de 56px y **barra de abajo flotante** (64px, a 12px de los bordes, sobre el contenido que pasa por debajo). El documento tiene `scroll-padding` para que lo enfocado no quede tapado; `Screen` deja abajo el alto de la barra, su margen y aire.

## 6. Interacción y táctil

- Objetivo táctil **≥ 48px** en botones (mínimo del proyecto, 44px) y **≥ 8px** entre objetivos.
- **Presionar es lo principal** (celular): los botones se achican a `--sdl-press-scale` (0,97) y oscurecen un poco (`brightness(.94)`); los botones de icono, 0,92. El hover solo en punteros finos (`@media (hover: hover)`).
- **Foco visible siempre:** `outline: 2px solid var(--sdl-focus-ring)` con `outline-offset: 3px`. Nunca `outline: none` sin reemplazo.
- **Estados:** `disabled` (opacidad 0,55, `cursor: not-allowed`) y `loading` (texto que cambia y `aria-busy`).

## 7. Movimiento

Solo donde aporte (CLAUDE.md, paso 3); solo `transform` y `opacity`.

| Token | Valor | Uso |
|---|---|---|
| `--sdl-duration-fast` | 120ms | Presión, hover |
| `--sdl-duration-base` | 200ms | Cambios de estado (la píldora de la barra) |
| `--sdl-duration-enter` | 320ms | Entrada de pantalla |
| `--sdl-duration-sheet` | 320ms | Hoja inferior al subir |
| `--sdl-duration-exit` | 160ms | Salidas (más rápidas que las entradas) |
| `--sdl-ease-out` | `cubic-bezier(.2,.8,.2,1)` | Entradas y estados |
| `--sdl-ease-sheet` | `cubic-bezier(.32,.72,0,1)` | La hoja llega rápido y se asienta |

Sin rebotes en el layout ni parallax. La hoja sigue al dedo y se cierra si baja más de 80px. Con `prefers-reduced-motion: reduce`, las duraciones pasan a 0.

## 8. Iconos e imágenes

- **Phosphor** (`@phosphor-icons/react`), peso `regular` (línea redondeada, como el Lucide del original) y `fill` en la pestaña activa. Se queda Phosphor: el original usa Lucide "como sustituto" (no tenía un set propio) y lo carga de unpkg, que una PWA sin conexión no puede. Cada icono **por su ruta** (`@phosphor-icons/react/dist/csr/House`), nunca desde el índice.
- Tamaños 16 en línea, 18–20 en botones, 22 en la barra, 28 en mosaicos de logros. Nada de emojis como iconos.
- Logros y categorías: icono centrado en un mosaico de color redondeado.
- Fotos de deportistas (cuando lleguen): luminosas y saturadas, recortadas sobre bloques de color. Mientras tanto, iniciales.
- Logos de terceros (Google) solo en su versión oficial.

## 9. Componentes base (`shared/ui`)

| Componente | Qué es | Notas |
|---|---|---|
| `Button` | `primary` (cobalto `--sdl-brand`, brillo), `secondary` (tarjeta con borde de control), `ghost`, `danger` | Píldora, Plus Jakarta 700, tipo oración, ancho completo en móvil, ≥ 48px |
| `ButtonLink` | Enlace (`<a>`) con forma de botón para ir a otra pantalla: `primary`, `secondary` o `accent` (volt, con tinta encima: el paso siguiente cuando el cobalto ya está en la pantalla) | Mismos estilos que `Button`; reemplaza los `primaryLink` sueltos de cada pantalla |
| `BottomNav` | Barra de **tinta flotante**, máximo 5 pestañas | La activa es una **píldora volt** con icono relleno y su nombre; las demás, solo icono (el nombre queda para el lector de pantalla). Globo cobalto de pendientes (9+) |
| `LeadTask` / `TaskRow` | "Lo que toca": el **bloque cobalto** (uno por pantalla) con botón volt, y las filas como tarjetas blancas con icono en recuadro y conteo en Space Grotesk | El bloque es lo más fuerte de la pantalla |
| `TeamHeader` | Escudo (iniciales en cobalto), nombre del equipo, club y formato; a la derecha tu ficha | Con más de un equipo, abre la hoja "Tus equipos" |
| `Token` | La ficha del jugador: dorsal o iniciales (Space Grotesk) en un disco con el aro de su línea; `tone="brand"` para el equipo o lo elegido; `injured` pone la crucecita | Tamaños 32/44/64/96. Decorativa salvo que lleve `label` |
| `PitchLines` / `Pitch` | **La cancha** (como `SportField` del original): pasto plano con franjas de corte y líneas blancas | Fichas blancas con el aro de su línea, nombres en blanco; lo destacado (la 1.ª del podio, tú, lo elegido, los huecos) en **volt**. `role="img"` con las posiciones en su etiqueta |
| `Sheet` | Hoja inferior modal (`<dialog>`), `radius-2xl` | Atrapa y devuelve el foco; se cierra con X, velo, Escape o arrastrando |
| `Row` | Fila de lista: tarjeta blanca redondeada (`radius-lg`, sombra) con 8px debajo; algo a la izquierda, título y una línea, un dato a la derecha | Al tocarla se achica como un botón |
| `Chips`, `Segmented`, `SectionTabs`, `SearchField`, `useUnsavedChanges` | Igual que en la v2, con los tokens nuevos | |

**Del original, para cuando hagan falta** (no existen todavía en la app): `StatTile`, `RingProgress`, `CompareBar`, `BarChart`, `ProgressBar`, `Avatar` cuadrado redondeado (30%), `Badge`, `Toast`, `Tooltip`, `TwoWeightTitle`, y `SportField` para fútbol sala, baloncesto, tenis, voleibol, natación y golf. Se construyen en `shared/ui` con CSS modules y estos tokens, siguiendo el original; no se importa su paquete de React.

## 10. Voz y tono (tres registros)

Una sola voz: cercana, clara, en español latinoamericano, de **tú**, sin jerga corporativa ni de club profesional, y **sin emojis** en la interfaz. Cambia el registro según con quién hablamos (decisión 2 de `08`):

| Registro | Con quién | Cómo | Ejemplo |
|---|---|---|---|
| **Camerino** | Jugadores, equipos de barrio | Animado, corto, celebra el progreso, nunca avergüenza | "¿Vas el sábado?", "¡Racha de 6 días!", "Fuiste la figura" |
| **Familia** | Papás y acudientes | Cálido y claro, sin jerga de fútbol que no entiendan | "Juan mejoró su pase este trimestre" |
| **Administrativo** | Cobros, inscripciones, pagos | Directo y preciso; nada de chistes con la plata | "Mensualidad de noviembre: $120.000, vence el 5" |

- **Botones con verbo:** "Guardar", "Confirmar asistencia", "Registrar".
- **Microcopia:** "Actualizado hace 2 h", "Sin resultados", "Guardaremos al reconectar."; estados "Pendiente / Al día / Vencido".
- **Menores** (decisión 1 de `08`): para niños, progreso propio y fortalezas, no notas ni tablas de posiciones; el detalle es del entrenador y del acudiente.

## 11. Pantallas propias

- **Entrada (`auth`, `join`, `onboarding`, `consent`):** en el login, el bloque cobalto lleva el sobretítulo, el título de dos pesos ("Tu equipo, / **siempre de local**") y una jugada sobre media cancha (líneas en `--sdl-on-brand-muted`, los nuestros en blanco, la subida en volt); el botón de Google va en `secondary` (blanco, como pide su marca). Al unirse, la convocatoria es el bloque cobalto y "Ir a mi equipo" va en volt. El resumen de la política, en filas con icono en recuadro. El texto y la acción, abajo, al pulgar.
- **Test y resultado (`quiz`, `result`, `history`, `science`):** la portada del test es el bloque cobalto (sobretítulo, la pregunta y el equipo) y "Empezar" queda al pulgar. En cada pregunta, el sobretítulo, la cifra del contador en Space Grotesk, la barra que se llena con `scaleX` y las opciones como tarjetas blancas (la elegida, borde y marca cobalto). En el resultado, el bloque cobalto lleva el dorsal en `--sdl-text-number` y el nombre; la cancha y el podio van en tarjetas, y en el podio la barra va debajo del nombre (así no se parte) y el porcentaje lleva espacio antes del % ("82 %").
- **Ficha 0–99 (`features/card`):** sin brillos ni degradados de videojuego. Lo fuerte es la mejor media (Space Grotesk en `--sdl-text-number`, cobalto) con su posición; los atributos en dos columnas con barra cobalto, las medias por posición con divisores punteados. En la ficha del jugador para el cuerpo técnico, los tres datos de arriba son mosaicos; si el dato es una palabra (la posición del test), va en texto y se parte por palabras, nunca por letras. Al puntuar, deslizadores nativos de 44px (`accent-color` cobalto, `touch-action: pan-y`).
- **Examen de conocimiento (`features/knowledge`):** una pregunta por pantalla; el reloj en Space Grotesk (cambia en los últimos 2 minutos y en el último; para lectores de pantalla avisa a los 5, 2 y 1); 20 marcas que se rellenan; revisión en grilla de 5 × 4 (≥ 44px); el resultado en el bloque cobalto, con el porcentaje en `--sdl-text-number` (el % a media altura), la banda y las correctas; las áreas con barra cobalto. El examen a medias es lo que toca en la lista: bloque cobalto con "Seguir con tu examen" en volt. Nunca las respuestas correctas.
- **Pizarra del examen (`ExamBoard`):** la jugada sobre el pasto con líneas blancas; los tuyos con **O**, los rivales con **X** (la forma lo dice); tú en volt; los puntos de respuesta son botones de 44px con anillo volt punteado y transparente; elegido, relleno de volt. Muestra en `/muestra/pizarra` (solo desarrollo).
- **Planificador (`features/lineup`):** la misma cancha; el aro dice qué tan bien encaja (éxito ≥ 65%, volt ≥ 40%, peligro debajo) y un punto volt marca lo fijado.
- **Después del partido (`AfterMatch`, D18):** el marcador es lo memorable (goles en `--sdl-text-number`, `−` / `+` redondos de 48px); evaluar es una fila de cinco palabras (Flojo · Regular · Bien · Muy bien · Figura), la elegida rellena.
- **Movimiento con intención:** la pregunta del test entra de lado; el podio se revela de la 3.ª a la 1.ª; las barras se llenan con `scaleX`.

## 12. Anti-patrones

- Colores sueltos o hex en componentes; tamaños fuera de la escala.
- **Volver a la v2:** verde de cancha oscuro como fondo de toda la app, ámbar o dorado, letra condensada en mayúsculas, aros y trazos de tiza. Es la estética que hoy repiten las herramientas de IA para el fútbol.
- Más de un bloque de color protagonista por pantalla.
- Borde de color a la izquierda de las tarjetas; el mismo radio y sombra en todo sin jerarquía.
- Mayúsculas espaciadas encima de cada bloque y títulos en mayúsculas (las mayúsculas, solo en insignias y sobretítulos).
- Metadatos unidos con punto medio ("A · B · C"): se escribe "A, B".
- Punto decimal ("4.5 h"): en Colombia, coma.
- Texto en volt sobre blanco, o en `ink-400`; color como única pista de un estado.
- Cargar fuentes, iconos o librerías desde un CDN (la app funciona sin conexión).
- Emojis en la interfaz; jerga corporativa ("onboarding", "dashboard").
- Rankings o comparaciones con el grupo para menores.
- Animaciones de `width`, `height` o `top`; animación sin `prefers-reduced-motion`; salidas más lentas que las entradas.
- Scroll horizontal de la página a 360px (una fila de filtros que se desliza dentro de sí misma sí vale).

## 13. Checklist por pantalla (antes del PR)

- [ ] Solo tokens de `tokens.css`; ningún hex en componentes.
- [ ] **Probada en claro y en oscuro**, a 360px de ancho, sin scroll horizontal.
- [ ] Objetivos táctiles ≥ 44px (48px en botones) y ≥ 8px entre ellos.
- [ ] Foco visible con teclado en todo lo interactivo.
- [ ] Contraste AA (§3.3); si se agrega un color, va a `contrast.test.ts`.
- [ ] Respeta `prefers-reduced-motion`.
- [ ] Textos en el registro correcto (§10), con coma decimal.
- [ ] Auditoría con `web-design-guidelines` y `vercel-react-best-practices`; críticos y altos corregidos.
