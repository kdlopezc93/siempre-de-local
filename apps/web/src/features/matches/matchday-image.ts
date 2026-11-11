import type { MatchRoster, PublishedLineupResponse } from '@sdl/contracts';

import {
  alpha,
  drawFooter,
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
import { posterWhen } from './lineup-image';

/*
 * El afiche "Día de partido" con los convocados (2026-11-10, Kevin eligió la A6 de la maqueta
 * `https://claude.ai/artifact/N99J2utVhLhXij9RWnZY4P`): con los colores del equipo; arriba
 * "Día de / partido" en grande, la hora enorme en el secundario y el día con la cancha; una
 * franja torcida de lado a lado con "VS" y el rival; abajo, sobre una media cancha de tiza, los
 * que van: cada uno con su dorsal en un disco y su nombre, en dos columnas.
 */

/** Hasta cuántos nombres caben; con más, los últimos van como "y 3 más". */
export const MAX_LISTED = 24;

/** Los convocados que salen en el afiche (con más de `MAX_LISTED`, el último renglón resume). */
export function listed<T>(people: readonly T[]): { shown: T[]; more: number } {
  if (people.length <= MAX_LISTED) return { shown: [...people], more: 0 };
  return { shown: people.slice(0, MAX_LISTED - 1), more: people.length - (MAX_LISTED - 1) };
}

/** El tamaño de cada renglón de la lista: más chico cuantos más convocados haya. */
export function rowSize(
  rows: number,
  available: number,
): { row: number; disc: number; text: number } {
  const row = Math.min(92, Math.floor(available / Math.max(rows, 1)));
  return {
    row,
    disc: Math.min(32, Math.round(row * 0.4)),
    text: Math.min(38, Math.round(row * 0.5)),
  };
}

/**
 * La franja: los dos equipos al mismo tamaño y el "vs" a la mitad, lo más grandes que quepan
 * (de 72 px para abajo; el rival se corta con "…" si aun así no cabe).
 */
function bandText(ctx: CanvasRenderingContext2D, team: string, rival: string, width: number) {
  let size = 72;
  for (;;) {
    const vsSize = Math.round(size * 0.5);
    const gap = Math.round(size * 0.28);
    ctx.font = `800 ${size}px ${FONT}`;
    const teamW = ctx.measureText(team).width;
    const rivalW = ctx.measureText(rival).width;
    ctx.font = `700 ${vsSize}px ${NUM}`;
    const vsW = ctx.measureText('vs').width;
    if (teamW + rivalW + vsW + 2 * gap <= width || size <= 40) {
      return { size, vsSize, gap, team: teamW, vs: vsW };
    }
    size -= 4;
  }
}

/** Cortar un nombre con "…" hasta que quepa en el ancho. */
function clip(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export interface MatchdayPlayer {
  displayName: string;
  jerseyNumber: number | null;
}

/**
 * Los convocados del afiche (2026-11-10, Kevin): los de la alineación publicada, titulares y
 * después la banca; sin alineación, los que dijeron "Voy" (sin lesionados).
 */
export function convocados(
  roster: MatchRoster,
  lineup: Pick<PublishedLineupResponse, 'starters' | 'bench'> | null,
): MatchdayPlayer[] {
  const pick = (p: MatchdayPlayer) => ({
    displayName: p.displayName,
    jerseyNumber: p.jerseyNumber,
  });
  if (lineup) {
    return [...lineup.starters.flatMap((s) => (s.player ? [s.player] : [])), ...lineup.bench].map(
      pick,
    );
  }
  return roster.filter((p) => p.reply === 'yes' && !p.injured).map(pick);
}

/**
 * Dibuja el afiche y lo devuelve como PNG; null si el navegador no puede dibujar (en ese caso se
 * manda solo el mensaje).
 */
export async function matchdayImage(input: {
  teamName: string;
  /** "Amistoso", "Campeonato, Liga del barrio". */
  kindLine: string;
  opponent: string;
  startsAt: string;
  place: string;
  /** Los que van, en el orden de la plantilla (dorsal y nombre). */
  players: readonly MatchdayPlayer[];
  /** Los colores del equipo (null: los de la app). */
  colors: readonly string[] | null;
}): Promise<File | null> {
  const poster = await posterCanvas(input.colors);
  if (!poster) return null;
  const { canvas, ctx, color } = poster;
  const when = posterWhen(input.startsAt);

  // El círculo central de tiza, asomado a la derecha.
  ctx.save();
  ctx.strokeStyle = alpha(color.fg, 0.12);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W + 40, SAFE_TOP + 280, 300, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Arriba, con aire entre cada cosa: qué partido, "Día de / partido", la hora, el día y la
  // cancha (en dos renglones si no cabe).
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color.soft;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(clip(ctx, input.kindLine, TEXT_WIDTH), LEFT, SAFE_TOP + 28);
  ctx.fillStyle = color.fg;
  ctx.font = `800 116px ${FONT}`;
  ctx.fillText('Día de', LEFT - 4, SAFE_TOP + 148);
  ctx.fillText('partido', LEFT - 4, SAFE_TOP + 254);

  ctx.fillStyle = color.accent;
  ctx.font = `700 120px ${NUM}`;
  ctx.fillText(when.time, LEFT - 4, SAFE_TOP + 392);
  const timeWidth = ctx.measureText(when.time).width;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(when.period, LEFT + timeWidth + 14, SAFE_TOP + 392);
  ctx.fillStyle = color.fg;
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(when.day, LEFT, SAFE_TOP + 454, TEXT_WIDTH);
  ctx.fillStyle = color.soft;
  ctx.font = `600 34px ${FONT}`;
  const placeLines = wrap(ctx, input.place, TEXT_WIDTH).slice(0, 2);
  placeLines.forEach((line, i) =>
    ctx.fillText(clip(ctx, line, TEXT_WIDTH), LEFT, SAFE_TOP + 502 + i * 44),
  );

  // La franja torcida, de lado a lado: "QLeones FC vs Classico XXI", el "vs" chiquito.
  const bandY = SAFE_TOP + 640 + (placeLines.length - 1) * 40;
  const BAND = 75;
  const TILT = Math.tan((6 * Math.PI) / 180) * (W / 2);
  ctx.save();
  ctx.translate(W / 2, bandY);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.fillStyle = color.accent;
  ctx.fillRect(-W, -BAND, W * 2, BAND * 2);
  ctx.textBaseline = 'middle';
  const band = bandText(ctx, input.teamName, input.opponent, W - 2 * LEFT - 20);
  let x = -W / 2 + LEFT + 10;
  ctx.fillStyle = color.onAccent;
  ctx.font = `800 ${band.size}px ${FONT}`;
  ctx.fillText(input.teamName, x, 4);
  x += band.team + band.gap;
  ctx.fillStyle = alpha(color.onAccent, 0.6);
  ctx.font = `700 ${band.vsSize}px ${NUM}`;
  ctx.fillText('vs', x, 6);
  x += band.vs + band.gap;
  ctx.fillStyle = color.onAccent;
  ctx.font = `800 ${band.size}px ${FONT}`;
  const bandEnd = -W / 2 + LEFT + 10 + (W - 2 * LEFT - 20);
  ctx.fillText(clip(ctx, input.opponent, bandEnd - x), x, 4);
  ctx.restore();

  // La media cancha de tiza, entera (con su borde de abajo) entre la franja y el pie: el
  // medio círculo arriba y, abajo, el área grande y el área chica, rectangulares (Kevin: que se
  // vea de fútbol).
  const pitch = {
    top: bandY + TILT + BAND + 34,
    bottom: SAFE_BOTTOM - 96,
    left: 48,
    right: W - 48,
  };
  ctx.save();
  ctx.strokeStyle = alpha(color.fg, 0.16);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(pitch.left, pitch.top, pitch.right - pitch.left, pitch.bottom - pitch.top, 28);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(pitch.left, pitch.top, pitch.right - pitch.left, pitch.bottom - pitch.top);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(W / 2, pitch.top, 120, 0, Math.PI);
  ctx.stroke();
  ctx.strokeRect(W / 2 - 240, pitch.bottom - 120, 480, 120);
  ctx.strokeRect(W / 2 - 110, pitch.bottom - 50, 220, 50);
  ctx.restore();
  ctx.restore();

  // Los convocados: el título con cuántos y, debajo, dos columnas (tres si son muchos) con el
  // disco y el nombre, centradas en lo que queda de cancha.
  const listLeft = LEFT + 16;
  const listWidth = W - 2 * listLeft;
  const headY = pitch.top + 66;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color.fg;
  ctx.font = `800 42px ${FONT}`;
  ctx.fillText('Convocados', listLeft, headY);
  ctx.textAlign = 'right';
  ctx.fillStyle = color.accent;
  ctx.font = `700 42px ${NUM}`;
  ctx.fillText(String(input.players.length), W - listLeft, headY);
  ctx.textAlign = 'left';

  const { shown, more } = listed(input.players);
  const entries = more > 0 ? [...shown, null] : shown;
  // Hasta 16 (un fútbol 11 con 5 en la banca) en dos columnas; más, en tres.
  const columns = entries.length > 16 ? 3 : 2;
  const rows = Math.ceil(entries.length / columns);
  const areaTop = headY + 24;
  const areaBottom = pitch.bottom - 24;
  const size = rowSize(rows, areaBottom - areaTop);
  const listTop = areaTop + Math.max(0, (areaBottom - areaTop - rows * size.row) / 2);
  const gap = 28;
  const colWidth = (listWidth - gap * (columns - 1)) / columns;
  entries.forEach((player, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = listLeft + col * (colWidth + gap);
    const cy = listTop + row * size.row + size.row / 2;
    if (!player) {
      ctx.fillStyle = color.soft;
      ctx.font = `700 ${size.text}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`y ${more} más`, x, cy);
      return;
    }
    ctx.beginPath();
    ctx.arc(x + size.disc, cy, size.disc, 0, Math.PI * 2);
    ctx.fillStyle = color.accent;
    ctx.fill();
    ctx.fillStyle = color.onAccent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(size.disc * 0.95)}px ${NUM}`;
    const code = player.jerseyNumber ?? player.displayName.slice(0, 2).toUpperCase();
    ctx.fillText(String(code), x + size.disc, cy + 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = color.fg;
    ctx.font = `700 ${size.text}px ${FONT}`;
    const nameX = x + size.disc * 2 + 14;
    ctx.fillText(clip(ctx, player.displayName, colWidth - (nameX - x)), nameX, cy + 1);
  });
  ctx.textBaseline = 'alphabetic';

  // El equipo ya va en la franja: el pie, solo con la app.
  drawFooter(ctx, '', color, SAFE_BOTTOM - 14);

  return posterFile(canvas, 'dia-de-partido.png');
}
