import type { PublishedLineupResponse } from '@sdl/contracts';
import { findFormation } from '@sdl/domain';

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
  wrap,
} from '../../shared/poster/poster';

/*
 * El afiche de la alineación para el grupo de WhatsApp (2026-11-06, Kevin eligió la dirección
 * "Cancha de tiza"): 1080×1920, también sirve de estado. Todo cobalto; arriba el rival en grande
 * y la hora en volt; la cancha rayada como el pasto recién podado, con líneas de tiza; cada
 * titular en un disco volt con su dorsal (el arquero en blanco) y la banca abajo.
 */
/** El pasto: un rectángulo redondeado; la cancha se ve desde el área rival hacia abajo. */
const TURF = { x: 60, y: 580, w: 960, h: 1080 };
/** De la cancha de la app (100×150) al afiche: arranca en y = 25, debajo del área rival. */
const TOP = 25;
const px = (x: number) => 110 + x * 8.6;
const py = (y: number) => 600 + (y - TOP) * 8.16;
const DISC = 52;
/**
 * La línea de fondo va al borde del pasto, no en su coordenada: así el arquero y su nombre
 * quedan dentro del área.
 */
const END = TURF.y + TURF.h - 2.5;

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

function drawPitch(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(TURF.x, TURF.y, TURF.w, TURF.h, 16);
  ctx.clip();
  // Franjas de corte: una más clara cada dos.
  ctx.fillStyle = COLOR.stripe;
  for (let y = TURF.y; y < TURF.y + TURF.h; y += 212) ctx.fillRect(TURF.x, y, TURF.w, 106);
  ctx.restore();
  // Las líneas de tiza: el borde es el del pasto (como en la maqueta: las franjas no se salen
  // de la cancha), la mitad, el círculo y las áreas de abajo.
  ctx.save();
  ctx.strokeStyle = COLOR.chalk;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(TURF.x + 2.5, TURF.y + 2.5, TURF.w - 5, TURF.h - 5, 14);
  ctx.moveTo(TURF.x, py(75));
  ctx.lineTo(TURF.x + TURF.w, py(75));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(50), py(75), 11 * 8.6, 11 * 8.16, 0, 0, Math.PI * 2);
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
}): Promise<File | null> {
  const formation = findFormation(input.lineup.formation);
  const poster = formation ? await posterCanvas() : null;
  if (!formation || !poster) return null;
  const { canvas, ctx } = poster;

  // Arriba: qué partido, contra quién (lo más grande), la hora y la cancha.
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.mist;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(input.kindLine, LEFT, 84, TEXT_WIDTH);
  ctx.fillStyle = COLOR.white;
  ctx.font = `700 60px ${FONT}`;
  ctx.fillText(input.teamName, LEFT, 134, TEXT_WIDTH);
  const them = input.opponent ? `vs ${input.opponent}` : 'Entreno';
  const size = fit(ctx, them, (s) => `800 ${s}px ${FONT}`, 132, TEXT_WIDTH);
  ctx.fillText(them, LEFT - 6, 214 + (132 - size) / 2);

  const when = posterWhen(input.startsAt);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOR.volt;
  ctx.font = `700 104px ${NUM}`;
  ctx.fillText(when.time, LEFT, 470);
  const timeWidth = ctx.measureText(when.time).width;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(
    `${when.period}, ${when.day}`,
    LEFT + timeWidth + 16,
    470,
    TEXT_WIDTH - timeWidth - 16,
  );
  ctx.fillStyle = COLOR.mist;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(input.place, LEFT, 536, TEXT_WIDTH);

  drawPitch(ctx);

  // Cada titular: el disco volt con su dorsal (o sus iniciales), el arquero en blanco.
  const at = new Map(input.lineup.starters.map((s) => [s.slotId, s.player]));
  ctx.textAlign = 'center';
  for (const slot of formation.slots) {
    const player = at.get(slot.id) ?? null;
    const x = px(slot.coord[0]);
    const y = py(slot.coord[1]);
    ctx.beginPath();
    ctx.arc(x, y, DISC, 0, Math.PI * 2);
    ctx.fillStyle = !player ? COLOR.empty : slot.position === 'POR' ? COLOR.white : COLOR.volt;
    ctx.fill();
    ctx.fillStyle = COLOR.ink;
    ctx.font = `700 48px ${NUM}`;
    ctx.textBaseline = 'middle';
    const code = player
      ? String(player.jerseyNumber ?? player.displayName.slice(0, 2).toUpperCase())
      : '–';
    ctx.fillText(code, x, y + 3);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLOR.white;
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText(player ? short(player.displayName) : 'Vacío', x, y + DISC + 40);
  }

  // La banca, debajo de la cancha.
  ctx.textAlign = 'left';
  const bench = input.lineup.bench
    .map((p) => (p.jerseyNumber !== null ? `${p.jerseyNumber} ${p.displayName}` : p.displayName))
    .join(', ');
  ctx.font = `600 34px ${FONT}`;
  ctx.fillStyle = COLOR.mist;
  const label = 'Banca ';
  ctx.fillText(label, LEFT, 1730);
  const labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = COLOR.white;
  ctx.font = `700 34px ${FONT}`;
  wrap(ctx, bench || 'Sin suplentes', TEXT_WIDTH - labelWidth)
    .slice(0, 3)
    .forEach((line, i) => ctx.fillText(line, LEFT + labelWidth, 1730 + i * 46));

  drawFooter(ctx, formation.label);

  return posterFile(canvas, 'alineacion.png');
}
