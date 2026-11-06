import type { MatchFormat, PlayerRating } from '@sdl/contracts';
import {
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  positionName,
  RATING_ATTRIBUTES,
} from '@sdl/domain';

import {
  COLOR,
  drawFooter,
  fit,
  FONT,
  LEFT,
  NUM,
  posterCanvas,
  posterFile,
  TEXT_WIDTH,
  W,
} from '../../shared/poster/poster';
import { FORMAT_LABEL } from '../shell/shell-nav';
import { cardHeadline, RATED_ON, rankedAverages } from './card-view';

type Card = Pick<PlayerRating, 'ratedAt' | 'position' | 'values' | 'positionAverages'>;

const DORSAL = 75;

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
}): Promise<File | null> {
  const headline = cardHeadline(input.card, input.format);
  const poster = headline ? await posterCanvas() : null;
  if (!headline || !poster) return null;
  const { canvas, ctx } = poster;

  // Arriba: el equipo, tu nombre y tu dorsal en un disco volt.
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.mist;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(input.team, LEFT, 84, TEXT_WIDTH - 2 * DORSAL - 24);
  ctx.fillStyle = COLOR.white;
  fit(ctx, input.name, (s) => `800 ${s}px ${FONT}`, 104, TEXT_WIDTH - 2 * DORSAL - 24);
  ctx.fillText(input.name, LEFT, 134);
  const cx = W - LEFT - DORSAL;
  const cy = 84 + DORSAL;
  ctx.beginPath();
  ctx.arc(cx, cy, DORSAL, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.volt;
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dorsal = input.jerseyNumber ?? input.name.slice(0, 2).toUpperCase();
  ctx.font = `700 ${String(dorsal).length > 2 ? 52 : 72}px ${NUM}`;
  ctx.fillText(String(dorsal), cx, cy + 4);

  // La media, enorme, y la posición.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLOR.volt;
  ctx.font = `700 380px ${NUM}`;
  ctx.fillText(String(headline.main.value), LEFT - 8, 290);
  ctx.fillStyle = COLOR.white;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(positionName(headline.main.pos, input.format), LEFT, 640, TEXT_WIDTH);
  ctx.fillStyle = COLOR.mist;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(
    `Puntuada por su cuerpo técnico el ${RATED_ON.format(new Date(input.card.ratedAt))}`,
    LEFT,
    724,
    TEXT_WIDTH,
  );

  // Los atributos, en dos columnas: los de portero si su posición es el arco.
  const keeper = headline.main.pos === 'POR' && input.card.values.GK_DIV !== undefined;
  const codes = keeper ? GOALKEEPER_ATTRIBUTES : OUTFIELD_ATTRIBUTES;
  const colWidth = (TEXT_WIDTH - 56) / 2;
  codes.forEach((code, i) => {
    const x = LEFT + (i % 2) * (colWidth + 56);
    const y = 860 + Math.floor(i / 2) * 190;
    const value = input.card.values[code] ?? 0;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR.mist;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(RATING_ATTRIBUTES[code].name, x, y + 60);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR.white;
    ctx.font = `700 64px ${NUM}`;
    ctx.fillText(String(value), x + colWidth, y + 62);
    ctx.fillStyle = 'rgb(255 255 255 / 18%)';
    ctx.beginPath();
    ctx.roundRect(x, y + 90, colWidth, 14, 7);
    ctx.fill();
    ctx.fillStyle = COLOR.volt;
    ctx.beginPath();
    ctx.roundRect(x, y + 90, Math.max(14, (colWidth * value) / 99), 14, 7);
    ctx.fill();
  });

  // Las mejores medias, sobre una franja de pasto recién podado.
  ctx.fillStyle = COLOR.stripe;
  ctx.fillRect(0, 1440, W, 200);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLOR.mist;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText('Mejores medias', LEFT, 1480);
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
    ctx.fillStyle = 'rgb(255 255 255 / 14%)';
    ctx.beginPath();
    ctx.roundRect(x, 1534, width, 64, 32);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOR.white;
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(label, x + 24, 1567);
    ctx.fillStyle = COLOR.volt;
    ctx.font = `700 32px ${NUM}`;
    ctx.fillText(String(value), x + 24 + labelWidth + 12, 1567);
    ctx.textBaseline = 'top';
    x += width + 16;
  }

  drawFooter(ctx, FORMAT_LABEL[input.format]);
  return posterFile(canvas, 'mi-tarjeta.png');
}
