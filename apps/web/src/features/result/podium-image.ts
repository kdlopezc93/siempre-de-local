import type { MatchFormat, PositionCode } from '@sdl/contracts';
import { PITCH_LAYOUT, POSITIONS, positionName } from '@sdl/domain';

import { percent } from '../../shared/format';
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
  wrap,
} from '../../shared/poster/poster';
import { POSITION_COPY } from './position-copy';

/** La cancha del podio en el afiche: la de la app (100×150) en 760×760. */
/** La cancha, más chica desde que todo va en la zona que no tapan los estados (2026-11-06). */
const PITCH = { x: 290, y: SAFE_TOP + 630, w: 500, h: 500 };
const K = PITCH.w / 760;
const px = (x: number) => PITCH.x + (x / 100) * PITCH.w;
const py = (y: number) => PITCH.y + (y / 150) * PITCH.h;

/**
 * El afiche de tu podio para el estado de WhatsApp (2026-11-06, Kevin): tu primera posición en
 * grande con su número, la cancha con las tres marcadas y la afinidad de cada una. null si no se
 * puede dibujar.
 */
export async function podiumImage(input: {
  name: string;
  team: string;
  format: MatchFormat;
  podium: readonly { pos: PositionCode; pct: number }[];
  /** Los colores del equipo (null: los de la app). */
  colors: readonly string[] | null;
}): Promise<File | null> {
  const [first] = input.podium;
  const poster = first ? await posterCanvas(input.colors) : null;
  if (!first || !poster) return null;
  const { canvas, ctx, color } = poster;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = color.soft;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText('Mis 3 posiciones', LEFT, SAFE_TOP);
  ctx.fillStyle = color.fg;
  ctx.font = `700 56px ${FONT}`;
  ctx.fillText(`${input.name}, ${input.team}`, LEFT, SAFE_TOP + 50, TEXT_WIDTH);

  // La primera: su número enorme en volt, su nombre y su frase.
  ctx.fillStyle = color.accent;
  ctx.font = `700 250px ${NUM}`;
  ctx.fillText(String(POSITIONS[first.pos].number), LEFT - 10, SAFE_TOP + 130);
  ctx.fillStyle = color.fg;
  const firstName = positionName(first.pos, input.format);
  fit(ctx, firstName, (s) => `800 ${s}px ${FONT}`, 92, TEXT_WIDTH);
  ctx.fillText(firstName, LEFT, SAFE_TOP + 390);
  ctx.fillStyle = color.soft;
  ctx.font = `600 36px ${FONT}`;
  wrap(ctx, POSITION_COPY[first.pos].tagline, TEXT_WIDTH)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, LEFT, SAFE_TOP + 500 + i * 44));

  // La cancha de tiza con las tres marcadas: la primera en volt.
  ctx.strokeStyle = color.chalk;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(PITCH.x, PITCH.y, PITCH.w, PITCH.h, 14);
  ctx.moveTo(PITCH.x, py(75));
  ctx.lineTo(PITCH.x + PITCH.w, py(75));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px(50), py(75), 84 * K, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(px(26), py(126), px(74) - px(26), PITCH.y + PITCH.h - py(126));
  ctx.strokeRect(px(26), PITCH.y, px(74) - px(26), py(24) - PITCH.y);
  const layout = PITCH_LAYOUT[input.format];
  // De la 3.ª a la 1.ª: la primera queda encima si se tocan.
  [...input.podium].reverse().forEach(({ pos }) => {
    const at = layout[pos];
    if (!at) return;
    const top = pos === first.pos;
    const r = top ? 42 : 34;
    ctx.beginPath();
    ctx.arc(px(at[0]), py(at[1]), r, 0, Math.PI * 2);
    ctx.fillStyle = top ? color.accent : color.fg;
    ctx.fill();
    ctx.fillStyle = top ? color.onAccent : color.onFg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${top ? 40 : 32}px ${NUM}`;
    ctx.fillText(String(POSITIONS[pos].number), px(at[0]), py(at[1]) + 3);
  });

  // El podio con la afinidad.
  input.podium.slice(0, 3).forEach(({ pos, pct }, i) => {
    const y = PITCH.y + PITCH.h + 50 + i * 58;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = color.soft;
    ctx.font = `700 38px ${NUM}`;
    ctx.fillText(String(i + 1), LEFT, y);
    ctx.fillStyle = color.fg;
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText(positionName(pos, input.format), LEFT + 76, y, TEXT_WIDTH - 260);
    ctx.textAlign = 'right';
    ctx.fillStyle = color.accent;
    ctx.font = `700 38px ${NUM}`;
    ctx.fillText(percent(pct), W - LEFT, y);
  });

  drawFooter(ctx, 'Test de posición', color, SAFE_BOTTOM - 14);
  return posterFile(canvas, 'mi-podio.png');
}
