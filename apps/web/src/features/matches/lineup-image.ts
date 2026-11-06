import type { PublishedLineupResponse } from '@sdl/contracts';
import { findFormation } from '@sdl/domain';

/*
 * El afiche de la alineación para el grupo de WhatsApp (2026-11-06, Kevin eligió la dirección
 * "Cancha de tiza"): 1080×1920, también sirve de estado. Todo cobalto; arriba el rival en grande
 * y la hora en volt; la cancha rayada como el pasto recién podado, con líneas de tiza; cada
 * titular en un disco volt con su dorsal (el arquero en blanco) y la banca abajo.
 */
const W = 1080;
const H = 1920;
const COLOR = {
  cobalt: '#3155e8',
  mist: '#c9d4fb',
  volt: '#d4f34a',
  ink: '#14161c',
  white: '#ffffff',
  stripe: 'rgb(255 255 255 / 9%)',
  chalk: 'rgb(255 255 255 / 32%)',
  empty: 'rgb(255 255 255 / 18%)',
};
const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
const NUM = "'Space Grotesk', 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

const LEFT = 72;
const TEXT_WIDTH = W - 2 * LEFT;

/** El pasto: un rectángulo redondeado; la cancha se ve desde el área rival hacia abajo. */
const TURF = { x: 60, y: 580, w: 960, h: 1080 };
/** De la cancha de la app (100×150) al afiche: arranca en y = 25, debajo del área rival. */
const TOP = 25;
const px = (x: number) => 90 + x * 9;
const py = (y: number) => 600 + (y - TOP) * 8.16;
const DISC = 52;
/**
 * La línea de fondo va al borde del pasto, no en su coordenada: así el arquero y su nombre
 * quedan dentro del área.
 */
const END = TURF.y + TURF.h - 12;

const short = (name: string) => (name.length > 11 ? name.split(' ')[0]!.slice(0, 11) : name);

/** La letra más grande (hasta `size`) con la que `text` cabe en `width`. */
function fit(
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
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
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
  ctx.strokeStyle = COLOR.chalk;
  ctx.lineWidth = 5;
  // Las bandas siguen hacia arriba (la cancha continúa); abajo, la línea de fondo.
  ctx.beginPath();
  ctx.moveTo(px(3), TURF.y);
  ctx.lineTo(px(3), END);
  ctx.lineTo(px(97), END);
  ctx.lineTo(px(97), TURF.y);
  ctx.moveTo(px(3), py(75));
  ctx.lineTo(px(97), py(75));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(50), py(75), 11 * 9, 11 * 8.16, 0, 0, Math.PI * 2);
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
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!formation || !ctx) return null;
  canvas.width = W;
  canvas.height = H;
  // Las fuentes de la app, si ya cargaron; si no, las del sistema.
  await Promise.all(
    [`800 132px ${FONT}`, `700 36px ${FONT}`, `600 36px ${FONT}`, `700 104px ${NUM}`].map((f) =>
      document.fonts?.load(f).catch(() => []),
    ),
  );

  ctx.fillStyle = COLOR.cobalt;
  ctx.fillRect(0, 0, W, H);

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

  ctx.fillStyle = COLOR.mist;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('Siempre de Local', LEFT, H - 56);
  ctx.textAlign = 'right';
  ctx.font = `700 28px ${NUM}`;
  ctx.fillText(formation.label, W - LEFT, H - 56);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new File([blob], 'alineacion.png', { type: 'image/png' }) : null;
}
