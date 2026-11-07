import { APP_COLORS, posterPalette, textOn, type PosterPalette } from '@sdl/domain';

/*
 * Los afiches para el grupo y el estado de WhatsApp (2026-11-06, "Cancha de tiza"): 1080×1920,
 * con los colores del equipo (2026-11-06; si no eligió, cobalto y volt): el fondo, las cifras en
 * el secundario y la tiza en el color del texto. Los comparten la alineación, la tarjeta, el podio
 * y el resultado.
 */
export const W = 1080;
export const H = 1920;
/**
 * Se dibuja en coordenadas de 1080×1920 pero el PNG sale a 1440×2560 (2026-11-06, Kevin: se veía
 * con poca resolución en el celular).
 */
export const SCALE = 4 / 3;
/**
 * La versión del diseño de los afiches, en la clave de cada imagen ya dibujada: al cambiar el
 * diseño, la app la vuelve a dibujar aunque la página siga abierta.
 */
export const POSTER_VERSION = 2;
/**
 * Lo que tapan los estados de WhatsApp e Instagram (2026-11-06, Kevin): arriba la barra de
 * progreso y el nombre; abajo la respuesta. Lo importante va entre estas dos líneas.
 */
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = H - 300;
export const LEFT = 72;
export const TEXT_WIDTH = W - 2 * LEFT;

/** Un color con transparencia, para las franjas y la tiza. */
export function alpha(hex: string, amount: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${Math.round(amount * 100)}%)`;
}

/** Los colores de un afiche: los del equipo (`posterPalette`) más sus transparencias. */
export interface PosterColors extends PosterPalette {
  /** El texto encima de un disco del color del texto (el arquero, el 2.º del podio). */
  onFg: string;
  /** Las franjas de pasto. */
  stripe: string;
  /** Las líneas de tiza. */
  chalk: string;
  /** Un disco vacío, el fondo de una barra. */
  empty: string;
}

export function posterColors(teamColors?: readonly string[] | null): PosterColors {
  const palette = posterPalette(teamColors);
  return {
    ...palette,
    onFg: textOn(palette.fg),
    stripe: alpha(palette.fg, 0.09),
    chalk: alpha(palette.fg, 0.32),
    empty: alpha(palette.fg, 0.18),
  };
}

export const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
export const NUM = "'Space Grotesk', 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

/**
 * Un lienzo de 1080×1920 (a 1440×2560 en el PNG), con los colores del equipo, con las fuentes de la app cargadas (si ya cargaron; si no, las
 * del sistema); null si el navegador no puede dibujar.
 */
export async function posterCanvas(teamColors?: readonly string[] | null): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  color: PosterColors;
} | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  canvas.width = Math.round(W * SCALE);
  canvas.height = Math.round(H * SCALE);
  ctx.scale(SCALE, SCALE);
  await Promise.all(
    [`800 132px ${FONT}`, `700 36px ${FONT}`, `600 36px ${FONT}`, `700 104px ${NUM}`].map((f) =>
      document.fonts?.load(f).catch(() => []),
    ),
  );
  const color = posterColors(teamColors);
  ctx.fillStyle = color.bg;
  ctx.fillRect(0, 0, W, H);
  return { canvas, ctx, color };
}

/** El PNG del afiche, como archivo para compartir. */
export async function posterFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new File([blob], name, { type: 'image/png' }) : null;
}

/** La letra más grande (hasta `size`) con la que `text` cabe en `width`. */
export function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  size: number,
  width: number,
): number {
  let current = size;
  ctx.font = font(current);
  while (current > 40 && ctx.measureText(text).width > width) {
    current -= 4;
    ctx.font = font(current);
  }
  return current;
}

/** Partir un texto en líneas que quepan en el ancho. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  return line ? [...lines, line] : lines;
}

const APP_LOGO = { cobalt: APP_COLORS[0], volt: APP_COLORS[1] };
const LOGO = 52;

/** El logo de la app (el de `public/favicon.svg`), de `size` px con la esquina en (x, y). */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = size / 512;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = APP_LOGO.cobalt;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 512, 96);
  ctx.fill();
  ctx.strokeStyle = 'rgb(255 255 255 / 92%)';
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(64, 256);
  ctx.lineTo(448, 256);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(256, 256, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = APP_LOGO.volt;
  ctx.beginPath();
  ctx.arc(256, 256, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Un borde suave: sobre un fondo cobalto el logo no se pierde.
  ctx.save();
  ctx.strokeStyle = 'rgb(255 255 255 / 45%)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, size * 0.1875);
  ctx.stroke();
  ctx.restore();
}

/** El pie de todos los afiches: el logo y la dirección de la app a la izquierda, algo propio a la derecha. */
export function drawFooter(
  ctx: CanvasRenderingContext2D,
  right: string,
  color: PosterColors,
  baseline = H - 56,
) {
  drawLogo(ctx, LEFT, baseline - LOGO + 10, LOGO);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color.fg;
  ctx.textAlign = 'left';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('siempredelocal.app', LEFT + LOGO + 16, baseline);
  ctx.fillStyle = color.soft;
  ctx.textAlign = 'right';
  ctx.font = `700 28px ${NUM}`;
  ctx.fillText(right, W - LEFT, baseline);
  ctx.textAlign = 'left';
}
