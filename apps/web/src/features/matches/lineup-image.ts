import type { PublishedLineupResponse } from '@sdl/contracts';
import { findFormation } from '@sdl/domain';

import { lineOfPosition, type TokenLine } from '../../shared/ui/Token';
import { matchWhen } from './match-view';

/*
 * La imagen de la alineación publicada para el grupo de WhatsApp (2026-11-06, Kevin): 1080×1920
 * (también sirve de estado). El bloque cobalto con el partido, la cancha como en la app y los
 * suplentes. Siempre en el tema claro, con los colores de `tokens.css`.
 */
const W = 1080;
const H = 1920;
const COLOR = {
  cobalt: '#3155e8',
  onCobalt: '#e3e9fd',
  canvas: '#f5f6f8',
  ink: '#14161c',
  muted: '#5f6573',
  field: '#2b733b',
  fieldDark: '#245c30',
  stripe: 'rgb(255 255 255 / 6%)',
  white: '#ffffff',
};
/** Los aros de cada línea; el de los volantes, el aqua del tema oscuro: el verde se pierde en el pasto. */
const RING: Record<TokenLine, string> = {
  portero: '#14161c',
  defensa: '#3155e8',
  medio: '#3cc8c9',
  ataque: '#c93d28',
};
const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
const NUM = "'Space Grotesk', 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

/** La cancha (100×150 de la app) escalada: 8.8 px por unidad, centrada. */
const S = 8.8;
const PITCH_X = (W - 100 * S) / 2;
const PITCH_Y = 330;

const short = (name: string) => (name.length > 11 ? name.split(' ')[0]!.slice(0, 11) : name);

/** Partir los suplentes en líneas que quepan en el ancho. */
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

function drawPitch(ctx: CanvasRenderingContext2D) {
  const u = (n: number) => n * S;
  ctx.save();
  ctx.translate(PITCH_X, PITCH_Y);
  ctx.fillStyle = COLOR.field;
  ctx.beginPath();
  ctx.roundRect(0, 0, u(100), u(150), u(4));
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = COLOR.stripe;
  for (let y = 0; y < 150; y += 30) ctx.fillRect(0, u(y), u(100), u(15));
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = u(0.8);
  ctx.strokeRect(u(3), u(3), u(94), u(144));
  ctx.beginPath();
  ctx.moveTo(u(3), u(75));
  ctx.lineTo(u(97), u(75));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(u(50), u(75), u(11), 0, Math.PI * 2);
  ctx.stroke();
  for (const [x, y, w, h] of [
    [26, 126, 48, 21],
    [38, 140, 24, 7],
    [26, 3, 48, 21],
    [38, 3, 24, 7],
  ] as const) {
    ctx.strokeRect(u(x), u(y), u(w), u(h));
  }
  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.arc(u(50), u(75), u(1.2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Dibuja la alineación y la devuelve como PNG; null si el navegador no puede dibujar (en ese
 * caso se manda solo el mensaje).
 */
export async function lineupImage(input: {
  lineup: PublishedLineupResponse;
  teamName: string;
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
    [`800 64px ${FONT}`, `600 30px ${FONT}`, `700 40px ${NUM}`].map((f) =>
      document.fonts?.load(f).catch(() => []),
    ),
  );

  ctx.fillStyle = COLOR.canvas;
  ctx.fillRect(0, 0, W, H);

  // El bloque cobalto: quiénes, cuándo y dónde.
  ctx.fillStyle = COLOR.cobalt;
  ctx.beginPath();
  ctx.roundRect(40, 40, W - 80, 250, 48);
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.onCobalt;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(`Alineación ${formation.label}`, 90, 115);
  ctx.fillStyle = COLOR.white;
  ctx.font = `800 64px ${FONT}`;
  const title = input.opponent ? `${input.teamName} vs ${input.opponent}` : input.teamName;
  ctx.fillText(title, 90, 192, W - 180);
  ctx.fillStyle = COLOR.onCobalt;
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(`${matchWhen(input.startsAt)} · ${input.place}`, 90, 250, W - 180);

  drawPitch(ctx);

  const at = new Map(input.lineup.starters.map((s) => [s.slotId, s.player]));
  ctx.textAlign = 'center';
  for (const slot of formation.slots) {
    const player = at.get(slot.id) ?? null;
    const x = PITCH_X + slot.coord[0] * S;
    const y = PITCH_Y + slot.coord[1] * S;
    ctx.beginPath();
    ctx.arc(x, y, 6 * S, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.white;
    ctx.fill();
    ctx.lineWidth = 1.2 * S;
    ctx.strokeStyle = RING[lineOfPosition(slot.position)];
    ctx.stroke();
    ctx.fillStyle = COLOR.ink;
    ctx.font = `700 ${4.2 * S}px ${NUM}`;
    const code = player
      ? String(player.jerseyNumber ?? player.displayName.slice(0, 2).toUpperCase())
      : '–';
    ctx.fillText(code, x, y + 1.5 * S);
    // El nombre en una píldora de pasto oscuro, para que se lea sobre las líneas. El del arco
    // va al lado de la ficha: abajo se saldría de la cancha y arriba tapa a los centrales.
    ctx.font = `600 ${3.6 * S}px ${FONT}`;
    const name = player ? short(player.displayName) : 'vacío';
    const width = ctx.measureText(name).width + 2.4 * S;
    const keeper = slot.coord[1] > 135;
    const nameX = keeper ? x + 7.5 * S + width / 2 : x;
    const nameY = keeper ? y + 1.3 * S : y + 10.5 * S;
    ctx.fillStyle = COLOR.fieldDark;
    ctx.beginPath();
    ctx.roundRect(nameX - width / 2, nameY - 3.6 * S, width, 5 * S, 2.5 * S);
    ctx.fill();
    ctx.fillStyle = COLOR.white;
    ctx.fillText(name, nameX, nameY);
  }

  // Los suplentes, debajo de la cancha.
  ctx.textAlign = 'left';
  let y = PITCH_Y + 150 * S + 60;
  ctx.fillStyle = COLOR.ink;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(`Suplentes (${input.lineup.bench.length})`, 60, y);
  ctx.fillStyle = COLOR.muted;
  ctx.font = `500 30px ${FONT}`;
  const bench = input.lineup.bench
    .map((p) => (p.jerseyNumber !== null ? `${p.jerseyNumber} ${p.displayName}` : p.displayName))
    .join(', ');
  for (const line of wrap(ctx, bench || 'Ninguno.', W - 120).slice(0, 3)) {
    y += 44;
    ctx.fillText(line, 60, y);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.muted;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText('Siempre de Local', W / 2, H - 28);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new File([blob], 'alineacion.png', { type: 'image/png' }) : null;
}
