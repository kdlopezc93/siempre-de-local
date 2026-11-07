import type { MatchFormat, PlayerRating } from '@sdl/contracts';
import {
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  positionName,
  RATING_ATTRIBUTES,
} from '@sdl/domain';

import {
  drawFooter,
  fit,
  FONT,
  LEFT,
  NUM,
  posterCanvas,
  posterFile,
  SAFE_BOTTOM,
  SAFE_TOP,
  TEXT_WIDTH,
  W,
} from '../../shared/poster/poster';
import { FORMAT_LABEL } from '../shell/shell-nav';
import { cardHeadline, RATED_ON, rankedAverages } from './card-view';

type Card = Pick<PlayerRating, 'ratedAt' | 'position' | 'values' | 'positionAverages'>;

const DORSAL = 75;
/** La franja de las mejores medias, encima del pie y dentro de la zona que no tapan los estados. */
const STRIPE_Y = SAFE_BOTTOM - 320;

/**
 * El afiche de tu tarjeta para el estado de WhatsApp (2026-11-06, Kevin): la media enorme en
 * volt con la posición, los atributos con su barra y tus mejores medias. Nunca las notas del
 * cuerpo técnico. null si no se puede dibujar o la tarjeta no tiene medias.
 */
export async function cardImage(input: {
  name: string;
  team: string;
  jerseyNumber: number | null;
  card: Card;
  format: MatchFormat;
  /** Los colores del equipo (null: los de la app). */
  colors: readonly string[] | null;
}): Promise<File | null> {
  const headline = cardHeadline(input.card, input.format);
  const poster = headline ? await posterCanvas(input.colors) : null;
  if (!headline || !poster) return null;
  const { canvas, ctx, color } = poster;

  // Arriba: el equipo, tu nombre y tu dorsal en un disco volt.
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = color.soft;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(input.team, LEFT, SAFE_TOP, TEXT_WIDTH - 2 * DORSAL - 24);
  ctx.fillStyle = color.fg;
  fit(ctx, input.name, (s) => `800 ${s}px ${FONT}`, 92, TEXT_WIDTH - 2 * DORSAL - 24);
  ctx.fillText(input.name, LEFT, SAFE_TOP + 50);
  const cx = W - LEFT - DORSAL;
  const cy = SAFE_TOP + DORSAL;
  ctx.beginPath();
  ctx.arc(cx, cy, DORSAL, 0, Math.PI * 2);
  ctx.fillStyle = color.accent;
  ctx.fill();
  ctx.fillStyle = color.onAccent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dorsal = input.jerseyNumber ?? input.name.slice(0, 2).toUpperCase();
  ctx.font = `700 ${String(dorsal).length > 2 ? 52 : 72}px ${NUM}`;
  ctx.fillText(String(dorsal), cx, cy + 4);

  // La media, enorme, y la posición.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color.accent;
  ctx.font = `700 300px ${NUM}`;
  ctx.fillText(String(headline.main.value), LEFT - 8, SAFE_TOP + 165);
  ctx.fillStyle = color.fg;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(positionName(headline.main.pos, input.format), LEFT, SAFE_TOP + 455, TEXT_WIDTH);
  ctx.fillStyle = color.soft;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(
    `Puntuada por su cuerpo técnico el ${RATED_ON.format(new Date(input.card.ratedAt))}`,
    LEFT,
    SAFE_TOP + 535,
    TEXT_WIDTH,
  );

  // Los atributos, en dos columnas: los de portero si su posición es el arco.
  const keeper = headline.main.pos === 'POR' && input.card.values.GK_DIV !== undefined;
  const codes = keeper ? GOALKEEPER_ATTRIBUTES : OUTFIELD_ATTRIBUTES;
  const colWidth = (TEXT_WIDTH - 56) / 2;
  codes.forEach((code, i) => {
    const x = LEFT + (i % 2) * (colWidth + 56);
    const y = SAFE_TOP + 590 + Math.floor(i / 2) * 160;
    const value = input.card.values[code] ?? 0;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = color.soft;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(RATING_ATTRIBUTES[code].name, x, y + 60);
    ctx.textAlign = 'right';
    ctx.fillStyle = color.fg;
    ctx.font = `700 64px ${NUM}`;
    ctx.fillText(String(value), x + colWidth, y + 62);
    ctx.fillStyle = color.empty;
    ctx.beginPath();
    ctx.roundRect(x, y + 90, colWidth, 14, 7);
    ctx.fill();
    ctx.fillStyle = color.accent;
    ctx.beginPath();
    ctx.roundRect(x, y + 90, Math.max(14, (colWidth * value) / 99), 14, 7);
    ctx.fill();
  });

  // Las mejores medias, sobre una franja de pasto recién podado.
  ctx.fillStyle = color.stripe;
  ctx.fillRect(0, STRIPE_Y, W, 180);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color.soft;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText('Mejores medias', LEFT, STRIPE_Y + 28);
  let x = LEFT;
  for (const { pos, value } of rankedAverages(input.card.positionAverages, input.format).slice(
    0,
    3,
  )) {
    const label = positionName(pos, input.format);
    ctx.font = `700 32px ${FONT}`;
    const labelWidth = ctx.measureText(label).width;
    ctx.font = `700 32px ${NUM}`;
    const valueWidth = ctx.measureText(String(value)).width;
    const width = labelWidth + valueWidth + 12 + 48;
    if (x + width > W - LEFT) break;
    ctx.fillStyle = color.stripe;
    ctx.beginPath();
    ctx.roundRect(x, STRIPE_Y + 84, width, 64, 32);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color.fg;
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(label, x + 24, STRIPE_Y + 117);
    ctx.fillStyle = color.accent;
    ctx.font = `700 32px ${NUM}`;
    ctx.fillText(String(value), x + 24 + labelWidth + 12, STRIPE_Y + 117);
    ctx.textBaseline = 'top';
    x += width + 16;
  }

  drawFooter(ctx, FORMAT_LABEL[input.format], color, SAFE_BOTTOM - 14);
  return posterFile(canvas, 'mi-tarjeta.png');
}
