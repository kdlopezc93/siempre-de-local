# Sistema de diseño v2 — "Pizarra táctica"

> Fuente de verdad visual de la PWA. Cada pantalla nueva consulta este documento; no se inventan colores ni tamaños sueltos (CLAUDE.md · Flujo de diseño). Tokens en `apps/web/src/shared/styles/tokens.css`.
>
> **v2 (Fase 6, 2026-10-22):** cambio fuerte pedido por el equipo ("se ve fea, anticuada, de formulario, con mucho texto"; `07-experiencia.md`). Se trabajó con `ui-ux-pro-max` (estilos, tipografías, guías de UX y navegación, reglas de app) y `frontend-design` (dirección estética). Para "club deportivo" la herramienta recomienda *Vibrant & Block-based* con modo oscuro; de ahí salen los bloques sólidos y la tipografía condensada. Su paleta genérica (rojo + Bebas Neue) se descartó otra vez. Maqueta navegable con los componentes reales: `/muestra` (solo en desarrollo).
>
> Origen: la identidad del prototipo (`docs/prototipo/detector-posicion.jsx`, bloque `CSS`), sistematizada con `ui-ux-pro-max`. La recomendación genérica de la herramienta para "app deportiva" (rojo claro + Bebas Neue, estilo marketing) **se descartó**: no encaja con la identidad ya validada ni con el tono de barrio. De la herramienta se adoptan las reglas de accesibilidad, táctiles y de movimiento.

---

## 1. Idea

Una **pizarra de vestuario con fichas magnéticas**: fondo verde muy oscuro como el pizarrón, trazos de tiza, el **ámbar** como la tiza de color con la que el técnico marca lo importante, y cada jugador como **una ficha redonda con su dorsal**. El color del aro de la ficha dice su línea. El icono de la app ya es eso: el círculo central con el punto ámbar.

- **Una cosa atrevida por pantalla:** en el inicio, "lo que toca" es un bloque ámbar sólido; en la ficha del jugador, su ficha grande. Lo demás, tranquilo.
- **Planos, no formularios:** la profundidad sale de cambiar de superficie (fondo → plano → elevado), no de cajas con borde. Los bordes quedan para controles y divisores.
- **Una línea, no un párrafo:** en pantalla, la cifra y el verbo. La explicación va en una hoja inferior ("¿Por qué?").
- **Cercano y de barrio:** segunda persona, español latinoamericano, sin jerga.
- **Para el celular, en la cancha:** contraste alto (se usa al aire libre), objetivos táctiles grandes, una columna y navegación con el pulgar (barra inferior).

**Se conserva** de la v1: el icono de la app, las animaciones de entrar (la pizarra que aparece, el texto que llega, el punto que respira y el subrayado de tiza), la tarjeta 0–99 y la cancha del planificador.

## 2. Modo de color

**Solo oscuro, a propósito.** La pizarra es la identidad; no hay tema claro. Se declara `color-scheme: dark` y `<meta name="theme-color" content="#0b140f">`. Si algún día se añade tema claro, se hace como tokens alternativos, nunca con colores sueltos en componentes.

## 3. Color

### 3.1 Paleta base

| Token | Hex | Uso |
|---|---|---|
| `--sdl-color-bg` | `#0b140f` | Fondo de la app (pizarra). Igual que el icono |
| `--sdl-color-bg-glow` | `#12241a` | Halo superior del fondo (`radial-gradient`) |
| `--sdl-color-surface` | `#13241b` | Plano: filas de tarea, buscador, hojas |
| `--sdl-color-surface-hover` | `#172b20` | Hover o presión sobre un plano |
| `--sdl-color-surface-selected` | `#1b3125` | Elevado: lo elegido, el disco de la ficha |
| `--sdl-color-line` | `#2a4a38` | Divisores (decorativos) |
| `--sdl-color-border-strong` | `#4f8468` | Bordes de **controles** |
| `--sdl-color-pitch-line` | `#3a6b52` | Trazos de la cancha (SVG) |
| `--sdl-color-chalk` | `#eef1ea` | Texto principal (tiza); aro del portero |
| `--sdl-color-dim` | `#9db3a4` | Texto secundario |
| `--sdl-color-accent` | `#e8b84b` | Acción principal, foco, lo destacado (ámbar) |
| `--sdl-color-on-accent` | `#0b140f` | Texto sobre ámbar |
| `--sdl-color-on-accent-muted` | `#4a3a12` | Texto secundario sobre ámbar |
| `--sdl-color-green` | `#4cc38a` | Éxito; aro de los medios |
| `--sdl-color-blue` | `#6cb4ee` | Información; aro de los defensas |
| `--sdl-color-coral` | `#f2836b` | Aro de los delanteros |
| `--sdl-color-red` / `-red-text` | `#e5555a` / `#ef6b6f` | Peligro (fondos y bordes) / texto de error |
| `--sdl-color-scrim` | `rgb(4 9 6 / 72%)` | Velo detrás de las hojas |

### 3.2 Roles semánticos

Los componentes usan **roles**, no la paleta: `--sdl-surface-raised`, `--sdl-on-primary-muted`, `--sdl-scrim`, `--sdl-line-portero|defensa|medio|ataque`, `--sdl-fg`, `--sdl-fg-muted`, `--sdl-bg`, `--sdl-surface`, `--sdl-border`, `--sdl-border-control`, `--sdl-primary`, `--sdl-on-primary`, `--sdl-focus-ring`, `--sdl-success`, `--sdl-danger`, `--sdl-danger-fg`, `--sdl-info`. Está prohibido escribir un hex en un componente.

### 3.3 Contraste verificado (WCAG 2.2)

Medido con la fórmula de luminancia relativa de WCAG sobre las tres superficies (fondo / plano / elevado):

| Color | Fondo | Plano | Elevado | Resultado |
|---|---|---|---|---|
| Tiza `#eef1ea` | 16.4 | 14.2 | 12.2 | AAA |
| Atenuado `#9db3a4` | 8.4 | 7.3 | 6.2 | AA texto |
| Ámbar `#e8b84b` | 10.2 | 8.8 | 7.5 | AAA |
| Verde `#4cc38a` | 8.5 | 7.3 | 6.3 | AA texto |
| Azul `#6cb4ee` | 8.4 | 7.3 | 6.2 | AA texto |
| Coral `#f2836b` | 7.3 | 6.4 | 5.4 | AA texto |
| Error `#ef6b6f` | 6.3 | 5.4 | 4.6 | AA texto |
| Borde de control `#4f8468` | 4.3 | 3.7 | 3.2 | ≥ 3:1 (1.4.11) |
| Divisor `#2a4a38` | 1.9 | 1.7 | 1.4 | Solo decorativo |
| Sobre ámbar: `#0b140f` / `#4a3a12` | 10.2 / 6.0 | | | AAA / AA |

Reglas: un borde que **es lo único** que delimita un control usa `--sdl-border-control`. El color de línea de las fichas **nunca es la única pista**: la posición va escrita al lado.

## 4. Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Display, números | **Barlow Condensed** (600–700) | Títulos, dorsales, medias, botones |
| Texto | **Barlow** (400–600) | Párrafos, filas, etiquetas, inputs |

Misma familia en dos anchos: aire deportivo de camiseta, números tabulares grandes y buena lectura al sol. Reemplaza a Oswald + Inter. Fuentes **autoalojadas** con `@fontsource` (solo el subconjunto latin): funcionan sin conexión y no dependen de Google Fonts.

| Token | Valor | Uso |
|---|---|---|
| `--sdl-text-xs` | 12px | Etiquetas de la barra, metadatos cortos |
| `--sdl-text-sm` | 14px | Metadatos, pistas |
| `--sdl-text-base` | 16px | Texto e inputs (evita el zoom de iOS) |
| `--sdl-text-lg` | 18px | Botón principal |
| `--sdl-text-xl` | clamp(22px, 6vw, 28px) | Títulos de bloque, de hoja y de pregunta |
| `--sdl-text-display` | clamp(36px, 10vw, 56px) | Título de pantalla |
| `--sdl-text-number` | clamp(48px, 15vw, 72px) | La media o el porcentaje protagonista |

- **Mayúsculas con moderación:** la v1 ponía mayúsculas espaciadas en títulos, botones y etiquetas. En la v2 los títulos y etiquetas van en tipo oración; nada de "eyebrows" en mayúsculas encima de cada bloque. Los títulos de grupo van en Barlow 600 atenuado.
- Altura de línea 1.5 para texto y 0.95–1.1 para display. Números siempre `tabular-nums`.

## 5. Espaciado, radios y forma

**Escala de 4px**: `--sdl-space-1` (4), `2` (8), `3` (12), `4` (16), `5` (20), `6` (24), `8` (32), `10` (40) y `14` (56).

| Token | Valor | Uso |
|---|---|---|
| `--sdl-radius-sm` | 10px | Inputs |
| `--sdl-radius-md` | 14px | Botones, filas de tarea, datos |
| `--sdl-radius-lg` | 20px | Bloques ("lo que toca"), hojas |
| `--sdl-radius-pill` | 999px | Filtros, buscador, conmutadores |

- **Contenedor:** una columna de `max-width: 560px`, gutter de 16px.
- **Bordes de 1.5px** (el trazo de tiza) solo en controles y divisores; las superficies se separan por tono.
- **Sin sombras:** profundidad por tono de superficie. Sí hay halos de foco.
- **Armazón:** encabezado de equipo de 56px y barra inferior de 64px, ambos con `env(safe-area-inset-*)`. El documento tiene `scroll-padding` de su alto para que lo enfocado no quede tapado.

## 6. Interacción y táctil

- Objetivo táctil **≥ 48px de alto** en botones primarios y secundarios (el mínimo del proyecto es 44px) y **≥ 8px** entre objetivos.
- **Foco visible siempre:** `outline: 2px solid var(--sdl-focus-ring)` con `outline-offset: 3px` en `:focus-visible`. Nunca `outline: none` sin reemplazo.
- **Estados:** `hover` (solo en punteros finos: `@media (hover: hover)`), `active` (`scale(0.98)`), `disabled` (opacidad 0.55 y `cursor: not-allowed`) y `loading` (texto que cambia más `aria-busy`, sin bloquear la lectura).
- Sin `cursor: pointer` en elementos que no hacen nada.

## 7. Movimiento

Solo donde aporte (CLAUDE.md, paso 3). Se anima únicamente `transform` y `opacity`.

| Token | Valor | Uso |
|---|---|---|
| `--sdl-duration-fast` | 160ms | Hover, presión |
| `--sdl-duration-base` | 240ms | Cambios de estado |
| `--sdl-duration-enter` | 450ms | Entrada de pantalla (`fade` + `translateY(10px)`) |
| `--sdl-ease-out` | `cubic-bezier(.2,.7,.2,1)` | Entradas |
| `--sdl-duration-sheet` | 320ms | Hoja inferior al subir |
| `--sdl-duration-exit` | 200ms | Salidas (más rápidas que las entradas) |
| `--sdl-ease-sheet` | `cubic-bezier(.32,.72,0,1)` | Como un resorte suave: la hoja llega rápido y se asienta |
| `--sdl-ease-in` | `cubic-bezier(.4,0,1,1)` | Salidas |

- **Respuesta al toque:** lo tocable se encoge un poco al presionar (`scale(0.96–0.98)`) en ≤ 160ms.
- **La hoja sigue al dedo** al arrastrarla (sin transición mientras se arrastra) y se cierra si baja más de 80px; la X, el velo y Escape son la alternativa.

Con `prefers-reduced-motion: reduce`, las duraciones pasan a 0 y la entrada se muestra en su estado final.

## 8. Iconos e imágenes

- **Phosphor** (`@phosphor-icons/react`), la familia que recomienda `ui-ux-pro-max`: SVG en línea, `currentColor`, peso `regular` y `fill` solo para la pestaña activa. Se importa **cada icono por su ruta** (`@phosphor-icons/react/dist/csr/House`), nunca desde el índice, para no inflar el paquete. No sale a internet.
- Tamaños: `--sdl-icon-sm` (18) y `--sdl-icon-md` (24). Nada de emojis como iconos.
- Decorativos con `aria-hidden="true"`; los botones de solo icono llevan `aria-label`.
- Logos de terceros (Google) solo en su versión oficial y sin recolorear.

## 9. Componentes base (`shared/ui`)

| Componente | Variantes | Notas |
|---|---|---|
| `Button` | `primary` (ámbar), `secondary` (borde `border-control`), `ghost` | Barlow Condensed, ancho completo en móvil, `min-height: 48px` |
| `Card` / panel | — | Superficie + línea + `radius-lg` |
| `Pitch` (`shared/ui`) | — | Única fuente de la cancha (`PITCH_LAYOUT` de `@sdl/domain`), solo con las posiciones del formato. Marca una lista ordenada: la 1.ª rellena de ámbar con halo que respira (se detiene con movimiento reducido); las demás, aro ámbar. Lleva `role="img"` con las posiciones en su etiqueta. **Modo plantilla** (`roster`, como el planificador del prototipo): la sigla de la posición en el círculo (ámbar relleno si hay alguien) y debajo quién juega ahí ("Ana +2"); sin nadie es un hueco, aro ámbar punteado y la palabra "hueco" |
| `ChalkUnderline` (`features/join`) | — | Subrayado a mano en tiza ámbar bajo un nombre que el técnico "marca" (la convocatoria). Se dibuja una vez con `scaleX` sobre el contenedor; es el único movimiento de su pantalla. Usarlo solo para ese gesto, no como decoración de títulos |

### Nuevos en la v2

| Componente | Qué es | Notas |
|---|---|---|
| `Token` | **La ficha magnética**: dorsal o iniciales en un disco con el aro de su línea (portero tiza, defensa azul, medio verde, ataque coral); `tone="amber"` para el equipo o lo elegido | Tamaños 32/44/64/96. Decorativa salvo que lleve `label`. `lineOfPosition(pos)` da la línea |
| `TeamHeader` | Encabezado fijo: escudo (iniciales en ficha ámbar), nombre del equipo, club y formato; a la derecha, **tu ficha** (tus iniciales), que lleva a Tu cuenta | Con más de un equipo, el escudo y el nombre son un botón que abre la hoja "Tus equipos" |
| `BottomNav` | Barra inferior, máximo 5 pestañas con icono y nombre | La activa: icono relleno, texto en tiza y el punto ámbar del icono de la app encima. Globo ámbar de pendientes (9+) |
| `Sheet` | Hoja inferior modal (`<dialog>`) | Atrapa y devuelve el foco; se cierra con X, velo, Escape o arrastrando la manija |
| `Chips` | Filtros en fila que se deslizan de lado | Botones con `aria-pressed`; el prendido se rellena de tiza. Con conteo, `aria-label` "Por valorar, 4" |
| `Segmented` | Conmutador de pocas opciones que cambian lo que se ve ("Lista \| Pizarra") | Botones con `aria-pressed` (no son pestañas con panel); 44px de alto |
| `SectionTabs` | Secciones de una pantalla larga ("Resumen · Tarjeta · Conocimiento · Valoraciones"), subrayadas en ámbar | Se deslizan de lado si no caben; `aria-pressed`; la elegida va en la URL (`?ver=`) |
| `SearchField` | Buscador redondo con lupa y X para limpiar | `type="search"`, etiqueta para lectores; la X reemplaza la del navegador |
| `Row` | Fila de lista que lleva a otra pantalla: ficha, título, una línea, dato a la derecha | 64px de alto, título truncado con `…` |
| `LeadTask` / `TaskRow` | "Lo que toca": el bloque ámbar (uno por pantalla) y las filas de tarea con icono y conteo | El bloque es lo más fuerte de la pantalla |

## 9.0 Ficha 0–99 (`features/card/PlayerCard`)

Una ficha de pizarra, **no** una carta de videojuego: sin escudo, brillos ni degradados. Lo único fuerte es su mejor media del formato del equipo (Barlow Condensed ~72px en ámbar) con el nombre de la posición; debajo, los atributos en dos columnas con un trazo de tiza que marca cuánto de 99, y las medias por posición ordenadas (la mejor en ámbar). Al puntuar, cada atributo es un deslizador nativo (`accent-color` ámbar, 44px de alto, `touch-action: pan-y` para no trabar el scroll) con el ancla de la escala debajo, que cambia mientras se mueve.

## 9.0.1 Examen de conocimiento (`features/knowledge`)

Mismo lenguaje que el test (una pregunta por pantalla, opciones de tiza que se rellenan de ámbar). Lo propio: **el reloj** grande arriba a la derecha (Barlow Condensed tabular, ámbar en los últimos 2 minutos y rojo en el último; para lectores de pantalla solo avisa a los 5, 2 y 1 minuto) y **una tira de 20 marcas** de tiza que se rellenan al responder. La revisión final es una grilla de 5 × 4 números (≥ 44 px) para volver a cualquier pregunta. El resultado repite la ficha: el porcentaje en grande en ámbar, la banda y las áreas con barras verdes; nunca las respuestas correctas.

Del lado del cuerpo técnico (perfil del jugador, sección "Conocimiento"): el mejor puntaje por posición en ámbar; una re-evaluación pedida va en un recuadro con borde ámbar y una vencida con borde rojo; los exámenes anulados o reemplazados van tachados en gris con etiquetas ("Reemplazado", "Re-evaluación", "Abandonado"). Anular y pedir re-evaluación abren un formulario en el lugar (el formulario es la confirmación); cancelar una re-evaluación pide "Sí, cancelarla".

## 9.0.2 Planificador (`features/lineup`)

La pizarra del planificador usa las mismas líneas (`PitchLines`) con los puestos de la formación: dorsal (o iniciales) en el círculo y el nombre debajo; **el aro dice qué tan bien encaja** (verde ≥ 65%, ámbar ≥ 40%, rojo debajo) y un punto ámbar marca lo **fijado**. Cada puesto es un botón (rol, teclado, foco visible) con área táctil de ~60 px. Se toca un puesto y después otro (o un suplente y después un puesto); lo movido queda fijado y el resto se reacomoda. Debajo, el encaje medio por línea; al elegir un puesto, su desglose (cuerpo técnico, tarjeta, conocimiento, test) con barras de tiza y "sin dato" cuando falta.

## 9.0.3 Después del partido (`features/matches/AfterMatch`, D18)

- **El marcador es lo memorable:** cada equipo en su mitad, partida por la línea del medio (`--sdl-pitch-stroke`); los goles en `--sdl-text-number` con `tabular-nums`, y `−` / `+` redondos de 48 px debajo (con `touch-action: manipulation`, para que tocar rápido sume y no haga zoom). La figura del partido es una ficha ámbar (`Token tone="amber"`) y se elige en una hoja.
- **Evaluar es una fila de cinco palabras** (Flojo · Regular · Bien · Muy bien · Figura) en una grilla de 5 columnas con 8 px entre botones; la elegida se rellena de ámbar (la palabra también lo dice, no solo el color). Se guarda al tocar, con "Guardando…" / "Guardada" por fila. La nota se abre aparte, y quitar una evaluación con nota pide confirmación.
- **El jugador** ve el mismo marcador sin − / + (solo lectura), la figura y, en ámbar grande (`--sdl-text-display`), su palabra con "Es la mirada de tu cuerpo técnico."; si fue la figura, "¡Fuiste la figura del partido!". En Mi juego, "Tus últimos partidos" con la misma fila que la ficha.
- En la lista de partidos, los jugados muestran el marcador ("2–1", y "2 a 1" para lectores de pantalla); en la ficha del jugador, "Últimos partidos" con la palabra en ámbar.

## 9.1 Movimiento con intención (Fase 2)

- **Paso de pregunta en el test:** la pregunta entra de lado (`translateX(16px)` + opacidad, `--sdl-duration-base`).
- **Revelado del podio:** filas de la 3.ª a la 1.ª, separadas 260 ms, y cada barra de afinidad se llena con `scaleX`. Cuando llega el resultado oficial tras el provisional, el podio se vuelve a revelar.
- Todo con `transform`/`opacity` y sin animación con `prefers-reduced-motion`.

## 10. Anti-patrones

- Colores sueltos o hex en componentes; tamaños fuera de la escala.
- **Pantallas de formulario:** todo en cajas con borde, enlaces subrayados en lista, botones de contorno uno debajo de otro.
- **Mayúsculas espaciadas encima de cada bloque** ("eyebrows") y títulos en mayúsculas por defecto.
- Metadatos unidos con punto medio ("A · B · C"): se escribe "A, B".
- Más de un bloque ámbar por pantalla; ámbar para cuerpo de texto largo.
- **Párrafos de explicación en pantalla:** van en una hoja "¿Por qué?".
- Color como única pista (la línea de la ficha siempre va con la posición escrita).
- Look de "club profesional": degradados brillantes, dorados metálicos, escudos genéricos.
- Jerga corporativa ("onboarding", "dashboard"): se dice "plantilla", "tu equipo", "entra".
- Importar iconos desde el índice de la librería.
- Animaciones de `width`, `height` o `top`; animación sin `prefers-reduced-motion`; salidas más lentas que las entradas.
- Scroll horizontal de la página a 360px (una fila de filtros que se desliza dentro de sí misma sí vale).

## 11. Checklist por pantalla (antes del PR)

- [ ] Solo tokens de `tokens.css`; ningún hex en componentes.
- [ ] Probada a 360px de ancho, sin scroll horizontal.
- [ ] Objetivos táctiles ≥ 44px (48px en botones) y ≥ 8px entre ellos.
- [ ] Foco visible con teclado en todo lo interactivo.
- [ ] Contraste AA verificado (ver §3.3).
- [ ] Respeta `prefers-reduced-motion`.
- [ ] Textos en español latinoamericano, tono cercano.
- [ ] Auditoría con `web-design-guidelines` y `vercel-react-best-practices`; críticos y altos corregidos.
