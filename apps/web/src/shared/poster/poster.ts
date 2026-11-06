/*
 * Los afiches para el grupo y el estado de WhatsApp (2026-11-06, "Cancha de tiza"): 1080×1920,
 * todo cobalto, las cifras en volt y la tiza en blanco. Los comparten la alineación, la tarjeta
 * y el podio. Siempre en el tema claro, con los colores de `tokens.css`.
 */
export const W = 1080;
export const H = 1920;
export const LEFT = 72;
export const TEXT_WIDTH = W - 2 * LEFT;

export const COLOR = {
  cobalt: '#3155e8',
  mist: '#c9d4fb',
  volt: '#d4f34a',
  ink: '#14161c',
  white: '#ffffff',
  stripe: 'rgb(255 255 255 / 9%)',
  chalk: 'rgb(255 255 255 / 32%)',
  empty: 'rgb(255 255 255 / 18%)',
};
export const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
export const NUM = "'Space Grotesk', 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

/**
 * Un lienzo cobalto de 1080×1920 con las fuentes de la app cargadas (si ya cargaron; si no, las
 * del sistema); null si el navegador no puede dibujar.
 */
export async function posterCanvas(): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  canvas.width = W;
  canvas.height = H;
  await Promise.all(
    [`800 132px ${FONT}`, `700 36px ${FONT}`, `600 36px ${FONT}`, `700 104px ${NUM}`].map((f) =>
      document.fonts?.load(f).catch(() => []),
    ),
  );
  ctx.fillStyle = COLOR.cobalt;
  ctx.fillRect(0, 0, W, H);
  return { canvas, ctx };
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

/** El pie de todos los afiches: la app a la izquierda y algo propio a la derecha. */
export function drawFooter(ctx: CanvasRenderingContext2D, right: string) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOR.mist;
  ctx.textAlign = 'left';
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('Siempre de Local', LEFT, H - 56);
  ctx.textAlign = 'right';
  ctx.font = `700 28px ${NUM}`;
  ctx.fillText(right, W - LEFT, H - 56);
  ctx.textAlign = 'left';
}
