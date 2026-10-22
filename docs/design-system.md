# Sistema de diseño — "Pizarra táctica"

> Fuente de verdad visual de la PWA. Cada pantalla nueva consulta este documento; no se inventan colores ni tamaños sueltos (CLAUDE.md · Flujo de diseño). Tokens en `apps/web/src/shared/styles/tokens.css`.
>
> Origen: la identidad del prototipo (`docs/prototipo/detector-posicion.jsx`, bloque `CSS`), sistematizada con `ui-ux-pro-max`. La recomendación genérica de la herramienta para "app deportiva" (rojo claro + Bebas Neue, estilo marketing) **se descartó**: no encaja con la identidad ya validada ni con el tono de barrio. De la herramienta se adoptan las reglas de accesibilidad, táctiles y de movimiento.

---

## 1. Idea

Una **pizarra de vestuario**: fondo verde muy oscuro como el pizarrón, trazos en blanco tiza, el **ámbar** como la tiza de color con la que el técnico marca lo importante. Nada de brillos de club profesional ni degradados de marketing.

- **Cercano y de barrio:** textos cortos, en segunda persona ("tu equipo", "entra"), español latinoamericano.
- **Directo:** una acción principal por pantalla, en ámbar. Todo lo demás es secundario.
- **Para el celular, en la cancha:** contraste alto (se usa al aire libre), objetivos táctiles grandes y una sola columna.

## 2. Modo de color

**Solo oscuro, a propósito.** La pizarra es la identidad; no hay tema claro. Se declara `color-scheme: dark` y `<meta name="theme-color" content="#0b140f">`. Si algún día se añade tema claro, se hace como tokens alternativos, nunca con colores sueltos en componentes.

## 3. Color

### 3.1 Paleta base (del prototipo)

| Token | Hex | Uso |
|---|---|---|
| `--sdl-color-bg` | `#0b140f` | Fondo de la app (pizarra) |
| `--sdl-color-bg-glow` | `#12241a` | Halo superior del fondo (`radial-gradient`) |
| `--sdl-color-surface` | `#111e17` | Paneles, tarjetas, inputs |
| `--sdl-color-surface-hover` | `#14241b` | Hover de superficies interactivas |
| `--sdl-color-surface-selected` | `#1a2b1f` | Superficie seleccionada / elevada |
| `--sdl-color-line` | `#2c4f3d` | Divisores y bordes **decorativos** |
| `--sdl-color-border-strong` | `#4a7d62` | Bordes de **controles** (inputs, botón secundario). Nuevo: ver §3.3 |
| `--sdl-color-pitch-line` | `#3a6b52` | Trazos de la cancha (SVG) |
| `--sdl-color-chalk` | `#eef1ea` | Texto principal (tiza) |
| `--sdl-color-dim` | `#8ba192` | Texto secundario, pistas, metadatos |
| `--sdl-color-accent` | `#e8b84b` | Acción principal, foco, lo destacado (ámbar) |
| `--sdl-color-on-accent` | `#0b140f` | Texto sobre ámbar |
| `--sdl-color-green` | `#4cc38a` | Éxito, barras de afinidad, contexto |
| `--sdl-color-blue` | `#5aa8e0` | Información neutra (planificador) |
| `--sdl-color-red` | `#e5555a` | Peligro: fondos/bordes de error, preparación baja |
| `--sdl-color-red-text` | `#ef6b6f` | **Texto** de error. Nuevo: ver §3.3 |

### 3.2 Roles semánticos

Los componentes usan **roles**, no la paleta: `--sdl-fg`, `--sdl-fg-muted`, `--sdl-bg`, `--sdl-surface`, `--sdl-border`, `--sdl-border-control`, `--sdl-primary`, `--sdl-on-primary`, `--sdl-focus-ring`, `--sdl-success`, `--sdl-danger`, `--sdl-danger-fg`, `--sdl-info`. Está prohibido escribir un hex en un componente.

### 3.3 Contraste verificado (WCAG 2.2)

| Par | Ratio | Resultado |
|---|---|---|
| Tiza sobre fondo / superficie | 16.4 / 15.1 | AAA |
| Atenuado sobre fondo / superficie | 6.8 / 6.2 | AA (texto normal) |
| Texto `on-accent` sobre ámbar | 10.2 | AAA |
| Verde sobre superficie | 7.8 | AAA |
| Azul sobre superficie | 6.6 | AA |
| Rojo `#e5555a` sobre superficie seleccionada | 4.1 | ✘ para texto → usar `--sdl-color-red-text` (5.7) |
| Línea `#2c4f3d` sobre superficie | 1.9 | ✘ para bordes de control (1.4.11 pide 3:1) → `--sdl-color-border-strong` (3.6) |

Regla: un borde que **es lo único** que delimita un control (input, botón sin relleno) usa `--sdl-border-control`. La línea del prototipo queda para divisores y tarjetas no interactivas.

## 4. Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Display / títulos / etiquetas | **Oswald** (400–700), MAYÚSCULAS, tracking amplio | Títulos, botones, eyebrows, números de dorsal |
| Texto | **Inter** (variable, 400–600) | Párrafos, opciones, inputs |

Fuentes **autoalojadas** con `@fontsource` (funcionan offline y no dependen de Google Fonts, lo que simplifica la CSP). `font-display: swap`.

| Token | Valor | Uso |
|---|---|---|
| `--sdl-text-xs` | 12px | Eyebrow, contadores (solo Oswald en mayúsculas) |
| `--sdl-text-sm` | 13px | Pistas, pie, metadatos |
| `--sdl-text-base` | 16px | Texto e inputs (16px evita el zoom de iOS al enfocar) |
| `--sdl-text-lg` | 17px | Botón principal |
| `--sdl-text-xl` | clamp(22px, 5.5vw, 28px) | Enunciado de pregunta, subtítulo |
| `--sdl-text-display` | clamp(34px, 9vw, 52px) | Título de pantalla |

- Altura de línea: 1.6 para texto, 0.98–1.2 para Oswald.
- Tracking de Oswald: `0.22em` en eyebrow, `0.1em` en botones, `0.01em` en el título display.
- Mínimo de texto de cuerpo: 13px; nunca menos de 12px, y solo en Oswald de mayúsculas.

## 5. Espaciado, radios y forma

**Escala de 4px**: `--sdl-space-1` (4) · `2` (8) · `3` (12) · `4` (16) · `5` (20) · `6` (24) · `8` (32) · `10` (40) · `14` (56).

| Token | Valor | Uso |
|---|---|---|
| `--sdl-radius-sm` | 11px | Inputs, toggles |
| `--sdl-radius-md` | 13px | Botones, opciones |
| `--sdl-radius-lg` | 16px | Paneles, pizarra |
| `--sdl-radius-pill` | 999px | Barras de progreso, chips |

- **Contenedor:** una columna de `max-width: 560px` centrada, con padding lateral de 18px (16px como mínimo a 360px).
- **Bordes de 1.5px** en superficies y controles: es el trazo de tiza del prototipo.
- **Sin sombras:** la profundidad se marca con bordes y con el cambio de superficie, no con `box-shadow`. Sí se usan halos de foco.

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

Con `prefers-reduced-motion: reduce`, las duraciones pasan a 0 y la entrada se muestra en su estado final.

## 8. Iconos e imágenes

- **SVG en línea**, trazo de 1.5–2px, `currentColor`. Nada de emojis como iconos.
- Iconos decorativos con `aria-hidden="true"`; los botones que solo tienen icono llevan `aria-label`.
- Logos de terceros (Google) solo en su versión oficial y sin recolorear.

## 9. Componentes base (`shared/ui`)

| Componente | Variantes | Notas |
|---|---|---|
| `Button` | `primary` (ámbar), `secondary` (borde `border-control`), `ghost` | Oswald en mayúsculas, ancho completo en móvil, `min-height: 48px` |
| `Card` / panel | — | Superficie + línea + `radius-lg` |
| `Eyebrow` | — | Oswald 12px, ámbar, tracking 0.22em |
| `Pitch` (`shared/ui`) | — | Única fuente de la cancha (`PITCH_LAYOUT` de `@sdl/domain`), solo con las posiciones del formato. Marca una lista ordenada: la 1.ª rellena de ámbar con halo que respira (se detiene con movimiento reducido); las demás, aro ámbar. Lleva `role="img"` con las posiciones en su etiqueta. **Modo plantilla** (`roster`, como el planificador del prototipo): la sigla de la posición en el círculo (ámbar relleno si hay alguien) y debajo quién juega ahí ("Ana +2"); sin nadie es un hueco, aro ámbar punteado y la palabra "hueco" |
| `ChalkUnderline` (`features/join`) | — | Subrayado a mano en tiza ámbar bajo un nombre que el técnico "marca" (la convocatoria). Se dibuja una vez con `scaleX` sobre el contenedor; es el único movimiento de su pantalla. Usarlo solo para ese gesto, no como decoración de títulos |

## 9.1 Movimiento con intención (Fase 2)

- **Paso de pregunta en el test:** la pregunta entra de lado (`translateX(16px)` + opacidad, `--sdl-duration-base`).
- **Revelado del podio:** filas de la 3.ª a la 1.ª, separadas 260 ms, y cada barra de afinidad se llena con `scaleX`. Cuando llega el resultado oficial tras el provisional, el podio se vuelve a revelar.
- Todo con `transform`/`opacity` y sin animación con `prefers-reduced-motion`.

## 10. Anti-patrones

- Colores sueltos o hex en componentes; tamaños fuera de la escala.
- Look de "club profesional": degradados brillantes, dorados metálicos, escudos genéricos.
- Jerga corporativa ("onboarding", "dashboard" en la UI): se dice "plantilla", "tu equipo", "entra".
- Bordes de 1px casi invisibles como única pista de un control.
- Animaciones de `width`, `height` o `top`; animación sin `prefers-reduced-motion`.
- Texto en ámbar sobre superficie para cuerpo largo: el ámbar es para destacar, no para leer.
- Scroll horizontal a 360px.

## 11. Checklist por pantalla (antes del PR)

- [ ] Solo tokens de `tokens.css`; ningún hex en componentes.
- [ ] Probada a 360px de ancho, sin scroll horizontal.
- [ ] Objetivos táctiles ≥ 44px (48px en botones) y ≥ 8px entre ellos.
- [ ] Foco visible con teclado en todo lo interactivo.
- [ ] Contraste AA verificado (ver §3.3).
- [ ] Respeta `prefers-reduced-motion`.
- [ ] Textos en español latinoamericano, tono cercano.
- [ ] Auditoría con `web-design-guidelines` y `vercel-react-best-practices`; críticos y altos corregidos.
