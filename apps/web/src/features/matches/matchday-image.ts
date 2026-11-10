import {
  alpha,
  drawFooter,
  fit,
  FONT,
  H,
  LEFT,
  NUM,
  posterCanvas,
  posterFile,
  SAFE_BOTTOM,
  SAFE_TOP,
  TEXT_WIDTH,
  W,
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
  const row = Math.min(78, Math.floor(available / Math.max(rows, 1)));
  return { row, disc: Math.round(row * 0.4), text: Math.min(34, Math.round(row * 0.5)) };
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
  ctx.strokeStyle = alpha(color.fg, 0.14);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W + 20, SAFE_TOP + 300, 320, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Arriba: qué partido y de quién, "Día de / partido", la hora y dónde.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color.soft;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(`${input.kindLine}, ${input.teamName}`, LEFT, SAFE_TOP + 30, TEXT_WIDTH);
  ctx.fillStyle = color.fg;
  ctx.font = `800 132px ${FONT}`;
  ctx.fillText('Día de', LEFT - 4, SAFE_TOP + 150);
  ctx.fillText('partido', LEFT - 4, SAFE_TOP + 270);

  ctx.fillStyle = color.accent;
  ctx.font = `700 132px ${NUM}`;
  ctx.fillText(when.time, LEFT - 4, SAFE_TOP + 410);
  const timeWidth = ctx.measureText(when.time).width;
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText(when.period, LEFT + timeWidth + 14, SAFE_TOP + 410);
  ctx.fillStyle = color.soft;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(`${when.day}, ${input.place}`, LEFT, SAFE_TOP + 466, TEXT_WIDTH);

  // La franja torcida, de lado a lado, con "VS" y el rival.
  const bandY = SAFE_TOP + 600;
  ctx.save();
  ctx.translate(W / 2, bandY);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.fillStyle = color.accent;
  ctx.fillRect(-W, -84, W * 2, 168);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = alpha(color.onAccent, 0.55);
  ctx.font = `700 84px ${NUM}`;
  const vsX = -W / 2 + LEFT + 40;
  ctx.fillText('VS', vsX, 4);
  const vsWidth = ctx.measureText('VS').width;
  ctx.fillStyle = color.onAccent;
  const rivalX = vsX + vsWidth + 28;
  fit(ctx, input.opponent, (s) => `800 ${s}px ${FONT}`, 84, W / 2 - LEFT - rivalX);
  ctx.fillText(input.opponent, rivalX, 4);
  ctx.restore();

  // La media cancha de tiza detrás de la lista, con medio círculo central.
  const pitchTop = bandY + 180;
  ctx.save();
  ctx.strokeStyle = alpha(color.fg, 0.18);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(48, H);
  ctx.lineTo(48, pitchTop + 28);
  ctx.arcTo(48, pitchTop, 76, pitchTop, 28);
  ctx.lineTo(W - 76, pitchTop);
  ctx.arcTo(W - 48, pitchTop, W - 48, pitchTop + 28, 28);
  ctx.lineTo(W - 48, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, pitchTop, 130, 0, Math.PI);
  ctx.stroke();
  ctx.restore();

  // Los convocados: el título con cuántos, y dos columnas con el disco y el nombre.
  const listLeft = LEFT + 16;
  const listWidth = W - 2 * listLeft;
  const headY = pitchTop + 70;
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
  const rows = Math.ceil(entries.length / 2);
  const listTop = headY + 30;
  const footerTop = SAFE_BOTTOM - 14 - 70;
  const size = rowSize(rows, footerTop - listTop);
  const colWidth = (listWidth - 32) / 2;
  entries.forEach((player, i) => {
    const col = i < rows ? 0 : 1;
    const row = i < rows ? i : i - rows;
    const x = listLeft + col * (colWidth + 32);
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
    const nameX = x + size.disc * 2 + 16;
    ctx.fillText(clip(ctx, player.displayName, colWidth - (nameX - x)), nameX, cy + 1);
  });
  ctx.textBaseline = 'alphabetic';

  drawFooter(ctx, `${input.players.length} van`, color, SAFE_BOTTOM - 14);

  return posterFile(canvas, 'dia-de-partido.png');
}
