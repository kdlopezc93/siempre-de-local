import type { ExamBoardView } from '@sdl/contracts';
import { BOARD_VIEWBOX, facingWords, visorPath } from '@sdl/domain';
import { useId } from 'react';

import { PitchLines } from '../../shared/ui/PitchLines';
import styles from './ExamBoard.module.css';

export interface BoardOption {
  id: string;
  label: string;
  letter: string;
  spot: { x: number; y: number } | null;
}

const ARROW_DASH = { pass: undefined, run: '2.4 1.6', dribble: '0.6 1.4' } as const;

/**
 * La jugada sobre el pasto (Fase 8): los tuyos con O, los rivales con X, el balón y las flechas
 * (pase continuo, desmarque a trazos, conducción punteada). Una visera blanca junto a la
 * ficha dice hacia dónde mira; para el lector de pantalla va en palabras. Los puntos de respuesta son
 * botones de verdad sobre la cancha; tocar uno es lo mismo que tocar su opción escrita.
 */
export function ExamBoard({
  board,
  options,
  chosen,
  disabled,
  onChoose,
}: {
  board: ExamBoardView;
  options: readonly BoardOption[];
  chosen: string | null;
  disabled: boolean;
  onChoose: (optionId: string) => void;
}) {
  const markerId = useId();
  const [vx, vy, vw, vh] = BOARD_VIEWBOX[board.view];
  const own = board.pieces.filter((p) => p.side === 'own').length;
  const rivals = board.pieces.length - own;
  const facings = board.pieces.flatMap((p) => {
    if (p.facing === undefined) return [];
    const who = p.you
      ? `Tú${p.label ? ` (${p.label})` : ''}`
      : p.side === 'own'
        ? `Tu compañero${p.label ? ` ${p.label}` : ''}`
        : `${p.label ? `El rival ${p.label}` : 'Un rival'}`;
    return [`${who}, ${facingWords(p.facing, p.side)}`];
  });
  const description =
    `Pizarra de la jugada: ${own} de tu equipo, ${rivals} rivales${board.ball ? ' y el balón' : ''}.` +
    (facings.length ? ` ${facings.join('. ')}.` : '');

  return (
    <figure className={styles.figure}>
      <div className={styles.board} style={{ aspectRatio: `${vw} / ${vh}` }}>
        <svg
          viewBox={`${vx} ${vy} ${vw} ${vh}`}
          className={styles.svg}
          role="img"
          aria-label={description}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L6,3 L0,6 z" className={styles.arrowHead} />
            </marker>
          </defs>
          <PitchLines />
          {board.arrows?.map((a, i) => (
            <line
              key={i}
              x1={a.from.x}
              y1={a.from.y}
              x2={a.to.x}
              y2={a.to.y}
              className={styles.arrow}
              strokeDasharray={ARROW_DASH[a.kind]}
              markerEnd={`url(#${markerId})`}
            />
          ))}
          {board.pieces.map(
            (p, i) =>
              p.facing !== undefined && (
                <path
                  key={`v${i}`}
                  d={visorPath(p, p.facing)}
                  className={p.you ? styles.visorYou : styles.visor}
                />
              ),
          )}
          {board.pieces.map((p, i) =>
            p.side === 'own' ? (
              <g key={i} className={p.you ? styles.you : styles.own}>
                <circle cx={p.x} cy={p.y} r={3.4} />
                {p.label && (
                  <text x={p.x} y={p.y + 1.3} className={styles.label}>
                    {p.label}
                  </text>
                )}
              </g>
            ) : (
              <g key={i} className={styles.rival}>
                <path
                  d={`M${p.x - 2.6},${p.y - 2.6} L${p.x + 2.6},${p.y + 2.6} M${p.x + 2.6},${p.y - 2.6} L${p.x - 2.6},${p.y + 2.6}`}
                />
                {p.label && (
                  <text x={p.x + 4.4} y={p.y - 2.2} className={styles.rivalLabel}>
                    {p.label}
                  </text>
                )}
              </g>
            ),
          )}
          {board.ball && (
            <circle cx={board.ball.x} cy={board.ball.y} r={1.7} className={styles.ball} />
          )}
        </svg>
        {options.map(
          (o) =>
            o.spot && (
              <button
                key={o.id}
                type="button"
                className={styles.spot}
                style={{
                  left: `${((o.spot.x - vx) / vw) * 100}%`,
                  top: `${((o.spot.y - vy) / vh) * 100}%`,
                }}
                aria-label={`Opción ${o.letter}: ${o.label}`}
                aria-pressed={chosen === o.id}
                disabled={disabled}
                onClick={() => onChoose(o.id)}
              >
                {o.letter}
              </button>
            ),
        )}
      </div>
      <figcaption className={styles.legend} aria-hidden="true">
        <span>O tu equipo</span>
        <span>X rivales</span>
        {board.pieces.some((p) => p.you) && <span className={styles.legendYou}>● tú</span>}
        {board.ball && <span>• balón</span>}
        {facings.length > 0 && <span>◠ hacia dónde mira</span>}
      </figcaption>
    </figure>
  );
}
