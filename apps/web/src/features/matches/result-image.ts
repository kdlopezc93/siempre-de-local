import type { Match } from '@sdl/contracts';
import { initialsOf } from '@sdl/domain';

import {
  alpha,
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
  type PosterColors,
} from '../../shared/poster/poster';
import { posterWhen } from './lineup-image';
import {
  nameParts,
  playerStats,
  scorerLines,
  statLabels,
  VERDICT_WORD,
  verdictOf,
  type MatchResult,
} from './result-view';

/*
 * Los afiches del resultado (2026-11-06, Kevin aprobó la maqueta): 1080×1920 con los colores del
 * equipo. "Marcador gigante" lo manda el cuerpo técnico al grupo; "La figura en grande" lo
 * comparte la figura en su estado.
 */

interface ResultPosterInput {
  match: Pick<Match, 'opponent' | 'startsAt' | 'place'>;
  result: MatchResult;
  teamName: string;
  /** "Amistoso", "Campeonato, Liga del barrio". */
  kindLine: string;
  colors: readonly string[] | null;
}

const CARD_COLOR = { yellow: '#f5c518', red: '#ff4d4d' } as const;

// Todo lo que se lee va entre SAFE_TOP y SAFE_BOTTOM: los estados tapan arriba y abajo.
const SCORE_BASELINE = SAFE_TOP + 420;
const BAND_Y = SCORE_BASELINE + 190;
const CHIP_Y = SAFE_TOP + 90;
const FOOTER_BASELINE = SAFE_BOTTOM - 14;
const RULE_Y = FOOTER_BASELINE - 60;

/** Arriba: "Final · Campeonato, Liga del barrio" y "domingo 8 nov · Cancha El Tunal". */
function drawHead(ctx: CanvasRenderingContext2D, color: PosterColors, input: ResultPosterInput) {
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `800 36px ${FONT}`;
  ctx.fillStyle = color.fg;
  const final = 'Final';
  ctx.fillText(final, LEFT, SAFE_TOP);
  const finalWidth = ctx.measureText(final).width;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillStyle = color.soft;
  ctx.fillText(` · ${input.kindLine}`, LEFT + finalWidth, SAFE_TOP, TEXT_WIDTH - finalWidth);
  ctx.fillText(
    `${posterWhen(input.match.startsAt).day} · ${input.match.place}`,
    LEFT,
    SAFE_TOP + 48,
    TEXT_WIDTH,
  );
}

/** Las tarjetas del partido en una fila: el cartoncito y el nombre. Devuelve si dibujó algo. */
function drawCards(
  ctx: CanvasRenderingContext2D,
  color: PosterColors,
  cards: MatchResult['cards'],
  y: number,
): boolean {
  if (cards.length === 0) return false;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 34px ${FONT}`;
  let x = LEFT;
  for (const card of cards) {
    const name = nameParts(card.player.displayName)[0];
    const width = 30 + 14 + ctx.measureText(name).width;
    if (x + width > W - LEFT) break;
    ctx.save();
    ctx.translate(x + 15, y);
    ctx.rotate((8 * Math.PI) / 180);
    ctx.fillStyle = CARD_COLOR[card.color];
    ctx.strokeStyle = alpha(color.fg, 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-15, -21, 30, 42, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color.fg;
    ctx.fillText(name, x + 44, y + 2);
    x += width + 36;
  }
  return true;
}

/** El disco del dorsal (o las iniciales) en el color secundario. */
function drawDisc(
  ctx: CanvasRenderingContext2D,
  color: PosterColors,
  player: { displayName: string; jerseyNumber: number | null },
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color.accent;
  ctx.fill();
  const code = String(player.jerseyNumber ?? initialsOf(player.displayName));
  ctx.fillStyle = color.onAccent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${code.length > 2 ? r * 0.7 : r * 0.95}px ${NUM}`;
  ctx.fillText(code, x, y + 4);
}

/**
 * "Marcador gigante": el marcador ocupa medio afiche (nuestros goles en el secundario, los del
 * rival solo con el contorno), una franja torcida dice cómo nos fue, los goleadores en grande y
 * la figura abajo. null si no se puede dibujar.
 */
export async function resultImage(input: ResultPosterInput): Promise<File | null> {
  const poster = await posterCanvas(input.colors);
  if (!poster) return null;
  const { canvas, ctx, color } = poster;
  const { result } = input;
  drawHead(ctx, color, input);

  // El marcador.
  const digits = String(result.goalsFor).length + String(result.goalsAgainst).length;
  const size = digits > 2 ? 300 : 400;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${size}px ${NUM}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = color.accent;
  ctx.fillText(String(result.goalsFor), LEFT - 10, SCORE_BASELINE);
  ctx.textAlign = 'right';
  ctx.strokeStyle = color.fg;
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.strokeText(String(result.goalsAgainst), W - LEFT, SCORE_BASELINE);
  ctx.textAlign = 'center';
  ctx.fillStyle = color.soft;
  ctx.font = `700 ${size * 0.4}px ${NUM}`;
  ctx.fillText('–', W / 2, SCORE_BASELINE - size * 0.25);

  // Los nombres debajo de cada número.
  ctx.textBaseline = 'top';
  const half = TEXT_WIDTH / 2 - 20;
  ctx.fillStyle = color.fg;
  ctx.textAlign = 'left';
  fit(ctx, input.teamName, (s) => `700 ${s}px ${FONT}`, 44, half);
  ctx.fillText(input.teamName, LEFT, SCORE_BASELINE + 30);
  const rival = input.match.opponent ?? 'Rival';
  ctx.textAlign = 'right';
  ctx.fillStyle = color.soft;
  fit(ctx, rival, (s) => `700 ${s}px ${FONT}`, 44, half);
  ctx.fillText(rival, W - LEFT, SCORE_BASELINE + 30);

  // La franja torcida en el tercer color (o el secundario), también cuando perdimos (Kevin: el
  // dorado de QLeones no aparecía nunca en las derrotas).
  const verdict = verdictOf(result);
  ctx.save();
  ctx.translate(W / 2, BAND_Y);
  ctx.rotate((-4 * Math.PI) / 180);
  ctx.fillStyle = color.band;
  ctx.fillRect(-W, -88, 2 * W, 176);
  ctx.fillStyle = color.onBand;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 130px ${FONT}`;
  ctx.fillText(VERDICT_WORD[verdict], 0, 6, W - 2 * LEFT);
  ctx.restore();

  // Abajo hacia arriba: el pie, las tarjetas y la figura; los goleadores llenan lo que queda.
  const rule = RULE_Y;
  ctx.strokeStyle = color.chalk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LEFT, rule);
  ctx.lineTo(W - LEFT, rule);
  ctx.stroke();
  const hasCards = drawCards(ctx, color, result.cards, rule - 56);
  let bottom = hasCards ? rule - 110 : rule - 40;
  if (result.figure) {
    const cy = bottom - 70;
    drawDisc(ctx, color, result.figure, LEFT + 70, cy, 70);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color.soft;
    ctx.font = `600 36px ${FONT}`;
    ctx.fillText('Figura del partido', LEFT + 176, cy - 12);
    ctx.fillStyle = color.fg;
    fit(ctx, result.figure.displayName, (s) => `800 ${s}px ${FONT}`, 64, TEXT_WIDTH - 176);
    ctx.fillText(result.figure.displayName, LEFT + 176, cy + 52);
    bottom = cy - 110;
  }

  // Los goleadores: el nombre en grande con "×2" y sus pases; los que no quepan, "y N más".
  const lines = scorerLines(result.goals);
  let y = BAND_Y + 130;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const [i, line] of lines.entries()) {
    const height = line.how ? 112 : 78;
    if (y + height > bottom) {
      ctx.fillStyle = color.soft;
      ctx.font = `600 36px ${FONT}`;
      ctx.fillText(`y ${lines.length - i} más`, LEFT, y + 40);
      break;
    }
    ctx.fillStyle = color.fg;
    const times = line.count > 1 ? ` ×${line.count}` : '';
    ctx.font = `800 60px ${FONT}`;
    const nameWidth = Math.min(ctx.measureText(line.name).width, TEXT_WIDTH - 140);
    ctx.fillText(line.name, LEFT, y + 58, TEXT_WIDTH - 140);
    if (times) {
      ctx.fillStyle = color.accent;
      ctx.font = `700 60px ${NUM}`;
      ctx.fillText(times, LEFT + nameWidth, y + 58);
    }
    if (line.how) {
      ctx.fillStyle = color.soft;
      ctx.font = `600 34px ${FONT}`;
      ctx.fillText(line.how, LEFT, y + 102, TEXT_WIDTH);
    }
    y += height + 16;
  }

  drawFooter(ctx, 'Resultado', color, FOOTER_BASELINE);
  return posterFile(canvas, 'resultado.png');
}

/**
 * "La figura en grande": su nombre enorme (el apellido en el secundario), su dorsal gigante de
 * fondo y sus números del partido; el marcador va arriba en una etiqueta. null si no hay figura o
 * no se puede dibujar.
 */
export async function figureImage(input: ResultPosterInput): Promise<File | null> {
  const figure = input.result.figure;
  const poster = figure ? await posterCanvas(input.colors) : null;
  if (!figure || !poster) return null;
  const { canvas, ctx, color } = poster;
  const { result } = input;

  // El dorsal de fondo, cortado por el borde.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = alpha(color.fg, 0.08);
  ctx.font = `700 1300px ${NUM}`;
  ctx.fillText(String(figure.jerseyNumber ?? initialsOf(figure.displayName)), W + 110, SAFE_TOP);

  drawHead(ctx, color, input);

  // La etiqueta del marcador y cómo nos fue.
  const rival = input.match.opponent ?? 'Rival';
  const score = `${result.goalsFor}–${result.goalsAgainst}`;
  ctx.font = `800 46px ${FONT}`;
  const team = nameParts(input.teamName)[0];
  const teamWidth = ctx.measureText(`${team} `).width;
  const rivalWidth = ctx.measureText(` ${rival}`).width;
  ctx.font = `700 58px ${NUM}`;
  const scoreWidth = ctx.measureText(score).width;
  const chipWidth = Math.min(TEXT_WIDTH, teamWidth + scoreWidth + rivalWidth + 96);
  ctx.fillStyle = color.band;
  ctx.beginPath();
  ctx.roundRect(LEFT, CHIP_Y, chipWidth, 96, 48);
  ctx.fill();
  ctx.fillStyle = color.onBand;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let x = LEFT + 48;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(`${team} `, x, CHIP_Y + 50);
  x += teamWidth;
  ctx.font = `700 58px ${NUM}`;
  ctx.fillText(score, x, CHIP_Y + 50);
  x += scoreWidth;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(` ${rival}`, x, CHIP_Y + 50, LEFT + chipWidth - 48 - x);
  ctx.fillStyle = color.fg;
  ctx.textBaseline = 'top';
  ctx.font = `700 48px ${FONT}`;
  ctx.fillText(VERDICT_WORD[verdictOf(result)], LEFT, CHIP_Y + 130);

  // De abajo hacia arriba: el pie, las tarjetas, "también marcaron", los números y el nombre.
  const rule = RULE_Y;
  ctx.strokeStyle = color.chalk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LEFT, rule);
  ctx.lineTo(W - LEFT, rule);
  ctx.stroke();
  let bottom = rule - 40;
  if (drawCards(ctx, color, result.cards, rule - 56)) bottom = rule - 110;

  const others = scorerLines(result.goals).filter((l) => l.name !== figure.displayName);
  if (others.length > 0) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 38px ${FONT}`;
    ctx.fillStyle = color.soft;
    const label = 'También marcaron: ';
    ctx.fillText(label, LEFT, bottom);
    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = color.fg;
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText(
      others.map((l) => (l.count > 1 ? `${l.short} (${l.count})` : l.short)).join(', '),
      LEFT + labelWidth,
      bottom,
      TEXT_WIDTH - labelWidth,
    );
    bottom -= 90;
  }

  const stats = statLabels(playerStats(result, figure.id));
  if (stats.length > 0) {
    let px = LEFT;
    const top = bottom - 84;
    for (const [n, label] of stats) {
      ctx.font = `700 46px ${NUM}`;
      const nWidth = ctx.measureText(String(n)).width;
      ctx.font = `700 40px ${FONT}`;
      const lWidth = ctx.measureText(label).width;
      const width = nWidth + lWidth + 12 + 72;
      ctx.strokeStyle = alpha(color.fg, 0.55);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(px, top, width, 84, 42);
      ctx.stroke();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = color.accent;
      ctx.font = `700 46px ${NUM}`;
      ctx.fillText(String(n), px + 36, top + 44);
      ctx.fillStyle = color.fg;
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText(label, px + 36 + nWidth + 12, top + 44);
      px += width + 20;
    }
    bottom = top - 56;
  }

  // El nombre: el de pila en el color del texto, el apellido en el secundario.
  const [first, last] = nameParts(figure.displayName);
  const nameFont = (s: number) => `800 ${s}px ${FONT}`;
  ctx.font = nameFont(210);
  const widest = [first, last].reduce((a, b) =>
    ctx.measureText(a).width >= ctx.measureText(b).width ? a : b,
  );
  const size = fit(ctx, widest, nameFont, 210, TEXT_WIDTH);
  const lineHeight = size * 0.92;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = nameFont(size);
  if (last) {
    ctx.fillStyle = color.accent;
    ctx.fillText(last, LEFT - 6, bottom);
    bottom -= lineHeight;
  }
  ctx.fillStyle = color.fg;
  ctx.fillText(first, LEFT - 6, bottom);
  ctx.fillStyle = color.soft;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText('Figura del partido', LEFT, bottom - size - 10);

  drawFooter(ctx, 'Figura', color, FOOTER_BASELINE);
  return posterFile(canvas, 'figura.png');
}
