import { BOARD_VIEWBOX, type ExamBoard } from '@sdl/domain';

/**
 * La pizarra de una pregunta como SVG suelto, para la hoja de revisión (Fase 8): los mismos
 * trazos que la app (`ExamBoard` en la web), con los colores de `tokens.css` escritos a mano
 * porque el archivo se abre fuera de la app (GitHub, impreso). La correcta va con anillo lleno.
 */
const BG = '#13241b';
const PITCH = '#3a6b52';
const CHALK = '#eef1ea';
const AMBER = '#e8b84b';
const INK = '#0b140f';

const DASH = {
  pass: '',
  run: ' stroke-dasharray="2.4 1.6"',
  dribble: ' stroke-dasharray="0.6 1.4"',
};

export function boardSvg(
  board: ExamBoard,
  letters: readonly string[],
  correctIndex: number | null,
): string {
  const [vx, vy, vw, vh] = BOARD_VIEWBOX[board.view];
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw * 4}" height="${vh * 4}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700">`,
    `<defs><marker id="h" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="${CHALK}"/></marker></defs>`,
    `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${BG}"/>`,
    `<g fill="none" stroke="${PITCH}" stroke-width="0.8">`,
    '<rect x="3" y="3" width="94" height="144"/><line x1="3" y1="75" x2="97" y2="75"/>',
    '<circle cx="50" cy="75" r="11"/><rect x="26" y="126" width="48" height="21"/>',
    '<rect x="38" y="140" width="24" height="7"/><rect x="26" y="3" width="48" height="21"/>',
    '<rect x="38" y="3" width="24" height="7"/></g>',
  ];
  for (const a of board.arrows ?? []) {
    out.push(
      `<line x1="${a.from.x}" y1="${a.from.y}" x2="${a.to.x}" y2="${a.to.y}" stroke="${CHALK}" stroke-width="0.7" stroke-linecap="round"${DASH[a.kind]} marker-end="url(#h)"/>`,
    );
  }
  for (const p of board.pieces) {
    if (p.side === 'own') {
      const fill = p.you ? AMBER : BG;
      out.push(
        `<circle cx="${p.x}" cy="${p.y}" r="3.4" fill="${fill}" stroke="${p.you ? AMBER : CHALK}" stroke-width="0.9"/>`,
      );
      if (p.label) {
        out.push(
          `<text x="${p.x}" y="${p.y + 1.3}" font-size="3.6" text-anchor="middle" fill="${p.you ? INK : CHALK}">${p.label}</text>`,
        );
      }
    } else {
      const d = 2.6;
      out.push(
        `<path d="M${p.x - d},${p.y - d} L${p.x + d},${p.y + d} M${p.x + d},${p.y - d} L${p.x - d},${p.y + d}" stroke="${CHALK}" stroke-width="1" stroke-linecap="round"/>`,
      );
      if (p.label) {
        out.push(
          `<text x="${p.x + 4.4}" y="${p.y - 2.2}" font-size="3.6" fill="${CHALK}">${p.label}</text>`,
        );
      }
    }
  }
  if (board.ball)
    out.push(`<circle cx="${board.ball.x}" cy="${board.ball.y}" r="1.7" fill="${CHALK}"/>`);
  (board.spots ?? []).forEach((s, i) => {
    const correct = i === correctIndex;
    out.push(
      `<circle cx="${s.x}" cy="${s.y}" r="5.5" fill="${correct ? AMBER : 'none'}" stroke="${AMBER}" stroke-width="0.7"${correct ? '' : ' stroke-dasharray="1.4 1"'}/>`,
      `<text x="${s.x}" y="${s.y + 1.6}" font-size="4.6" text-anchor="middle" fill="${correct ? INK : AMBER}">${letters[i] ?? ''}</text>`,
    );
  });
  out.push('</svg>');
  return `${out.join('\n')}\n`;
}
