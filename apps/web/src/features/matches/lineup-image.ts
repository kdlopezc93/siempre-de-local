import type { PublishedLineupResponse } from '@sdl/contracts';
import { contrastRatio, findFormation } from '@sdl/domain';

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
  type PosterColors,
  TEXT_WIDTH,
  wrap,
} from '../../shared/poster/poster';

/*
 * El afiche de la alineación para el grupo de WhatsApp (2026-11-06, Kevin eligió la dirección
 * "Cancha de tiza"): 1080×1920, también sirve de estado. Con los colores del equipo; arriba el
 * rival en grande y la hora en el secundario; la cancha rayada como el pasto recién podado, con líneas de tiza; cada
 * titular en un disco volt con su dorsal (el arquero en blanco) y la banca abajo.
 */
/** El pasto: un rectángulo redondeado; la cancha se ve desde el área rival hacia abajo. */
const TURF = { x: 60, y: SAFE_TOP + 380, w: 960, h: 840 };
/** De la cancha de la app (100×150) al afiche: arranca en y = 25, debajo del área rival. */
const TOP = 25;
const px = (x: number) => 110 + x * 8.6;
/** Cuánto mide en el afiche una unidad de alto de la cancha de la app. */
const SY = (TURF.h * 8.16) / 1080;
const py = (y: number) => TURF.y + 16 + (y - TOP) * SY;
const DISC = 44;
/**
 * La línea de fondo va al borde del pasto, no en su coordenada: así el arquero y su nombre
 * quedan dentro del área.
 */
const END = TURF.y + TURF.h - 2.5;
/** La banca, debajo de la cancha y encima del pie. */
const BENCH_Y = TURF.y + TURF.h + 50;

const short = (name: string) => (name.length > 11 ? name.split(' ')[0]!.slice(0, 11) : name);

const TIME = new Intl.DateTimeFormat('es-419', { hour: 'numeric', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('es-419', { weekday: 'long', day: 'numeric', month: 'short' });

/** "3:00", "p. m." y "domingo 8 nov", en la hora del celular. */
export function posterWhen(iso: string) {
  const date = new Date(iso);
  const part = (format: Intl.DateTimeFormat, type: Intl.DateTimeFormatPartTypes) =>
    format.formatToParts(date).find((p) => p.type === type)?.value ?? '';
  return {
    time: `${part(TIME, 'hour')}:${part(TIME, 'minute')}`,
    period: part(TIME, 'dayPeriod').replace('p.m.', 'p. m.').replace('a.m.', 'a. m.'),
    day: `${part(DAY, 'weekday')} ${part(DAY, 'day')} ${part(DAY, 'month')}`,
  };
}

function drawPitch(ctx: CanvasRenderingContext2D, color: PosterColors) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(TURF.x, TURF.y, TURF.w, TURF.h, 16);
  ctx.clip();
  // Franjas de corte: una más clara cada dos.
  ctx.fillStyle = color.stripe;
  for (let y = TURF.y; y < TURF.y + TURF.h; y += 212) ctx.fillRect(TURF.x, y, TURF.w, 106);
  ctx.restore();
  // Las líneas de tiza: el borde es el del pasto (como en la maqueta: las franjas no se salen
  // de la cancha), la mitad, el círculo y las áreas de abajo.
  ctx.save();
  ctx.strokeStyle = color.chalk;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(TURF.x + 2.5, TURF.y + 2.5, TURF.w - 5, TURF.h - 5, 14);
  ctx.moveTo(TURF.x, py(75));
  ctx.lineTo(TURF.x + TURF.w, py(75));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(50), py(75), 11 * 8.6, 11 * SY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(px(26), py(126), px(74) - px(26), END - py(126));
  ctx.strokeRect(px(38), py(140), px(62) - px(38), END - py(140));
  ctx.restore();
}

/**
 * Dibuja el afiche y lo devuelve como PNG; null si el navegador no puede dibujar (en ese caso se
 * manda solo el mensaje).
 */
export async function lineupImage(input: {
  lineup: PublishedLineupResponse;
  teamName: string;
  /** "Amistoso", "Campeonato, Liga del barrio". */
  kindLine: string;
  opponent: string | null;
  startsAt: string;
  place: string;
  /** Los colores del equipo (null: los de la app). */
  colors: readonly string[] | null;
}): Promise<File | null> {
  const formation = findFormation(input.lineup.formation);
  const poster = formation ? await posterCanvas(input.colors) : null;
  if (!formation || !poster) return null;
  const { canvas, ctx, color } = poster;

  // Arriba: qué partido, contra quién (lo más grande), la hora y la cancha.
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = color.soft;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(input.kindLine, LEFT, SAFE_TOP, TEXT_WIDTH);
  ctx.fillStyle = color.fg;
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(input.teamName, LEFT, SAFE_TOP + 46, TEXT_WIDTH);
  const them = input.opponent ? `vs ${input.opponent}` : 'Entreno';
  const size = fit(ctx, them, (s) => `800 ${s}px ${FONT}`, 112, TEXT_WIDTH);
  ctx.fillText(them, LEFT - 6, SAFE_TOP + 108 + (112 - size) / 2);

  const when = posterWhen(input.startsAt);
  ctx.textBaseline = 'alphabetic';
  // La hora en el tercer color del equipo si se lee como texto (el dorado de QLeones).
  ctx.fillStyle = contrastRatio(color.band, color.bg) >= 3 ? color.band : color.accent;
  ctx.font = `700 88px ${NUM}`;
  ctx.fillText(when.time, LEFT, SAFE_TOP + 304);
  const timeWidth = ctx.measureText(when.time).width;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(
    `${when.period}, ${when.day}`,
    LEFT + timeWidth + 16,
    SAFE_TOP + 304,
    TEXT_WIDTH - timeWidth - 16,
  );
  ctx.fillStyle = color.soft;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(input.place, LEFT, SAFE_TOP + 354, TEXT_WIDTH);

  drawPitch(ctx, color);

  // Cada titular: el disco volt con su dorsal (o sus iniciales), el arquero en blanco.
  const at = new Map(input.lineup.starters.map((s) => [s.slotId, s.player]));
  ctx.textAlign = 'center';
  for (const slot of formation.slots) {
    const player = at.get(slot.id) ?? null;
    const x = px(slot.coord[0]);
    const y = py(slot.coord[1]);
    ctx.beginPath();
    ctx.arc(x, y, DISC, 0, Math.PI * 2);
    ctx.fillStyle = !player ? color.empty : slot.position === 'POR' ? color.fg : color.accent;
    ctx.fill();
    ctx.fillStyle = !player ? color.fg : slot.position === 'POR' ? color.onFg : color.onAccent;
    ctx.font = `700 42px ${NUM}`;
    ctx.textBaseline = 'middle';
    const code = player
      ? String(player.jerseyNumber ?? player.displayName.slice(0, 2).toUpperCase())
      : '–';
    ctx.fillText(code, x, y + 3);
  }
  // Los nombres después de todos los discos y con un borde del color del fondo: en las
  // formaciones con dos filas muy juntas (3-5-2), el de un central toca el disco del arquero.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 32px ${FONT}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = color.bg;
  ctx.fillStyle = color.fg;
  for (const slot of formation.slots) {
    const player = at.get(slot.id) ?? null;
    const name = player ? short(player.displayName) : 'Vacío';
    const x = px(slot.coord[0]);
    const y = py(slot.coord[1]) + DISC + 34;
    ctx.strokeText(name, x, y);
    ctx.fillText(name, x, y);
  }

  // La banca, debajo de la cancha.
  ctx.textAlign = 'left';
  const bench = input.lineup.bench
    .map((p) => (p.jerseyNumber !== null ? `${p.jerseyNumber} ${p.displayName}` : p.displayName))
    .join(', ');
  ctx.font = `600 32px ${FONT}`;
  ctx.fillStyle = color.soft;
  const label = 'Banca ';
  ctx.fillText(label, LEFT, BENCH_Y);
  const labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = color.fg;
  ctx.font = `700 32px ${FONT}`;
  wrap(ctx, bench || 'Sin suplentes', TEXT_WIDTH - labelWidth)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, LEFT + labelWidth, BENCH_Y + i * 42));

  drawFooter(ctx, formation.label, color, SAFE_BOTTOM - 14);

  return posterFile(canvas, 'alineacion.png');
}
