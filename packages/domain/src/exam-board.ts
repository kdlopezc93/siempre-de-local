/**
 * Preguntas tipo pizarra del examen de conocimiento (02 §6.2, Fase 8): la jugada dibujada en
 * tiza sobre la cancha de siempre (viewBox 100×150, tu arco abajo). Cada opción puede tener su
 * punto en la cancha; las letras A–D las pone el celular después de barajar, así que el dibujo
 * no delata la correcta.
 */
export interface BoardPoint {
  x: number;
  y: number;
}

export type BoardView = 'full' | 'own-half' | 'rival-half';

export interface ExamBoard {
  /** Qué parte de la cancha se ve: entera, tu mitad (con tu arco) o la del rival. */
  view: BoardView;
  /** Los tuyos (O) y los rivales (X); `you` es el jugador que responde (uno como mucho). */
  pieces: readonly (BoardPoint & { side: 'own' | 'rival'; label?: string; you?: boolean })[];
  ball?: BoardPoint;
  /** Pase (línea continua), desmarque (punteada) o conducción (ondulada). */
  arrows?: readonly { kind: 'pass' | 'run' | 'dribble'; from: BoardPoint; to: BoardPoint }[];
  /** Un punto por opción, en el orden en que se escriben. Sin `spots`, solo se mira. */
  spots?: readonly BoardPoint[];
}

/** Recorte del viewBox según la vista: [x, y, ancho, alto]. */
export const BOARD_VIEWBOX: Readonly<Record<BoardView, readonly [number, number, number, number]>> =
  {
    full: [0, 0, 100, 150],
    'own-half': [0, 72, 100, 78],
    'rival-half': [0, 0, 100, 78],
  };

/**
 * Distancia mínima entre dos puntos de respuesta (en unidades de la cancha): a 360 px de ancho
 * cada unidad mide ~3,3 px, así que 15 dejan los botones de 48 px sin pisarse.
 */
export const MIN_SPOT_DISTANCE = 15;
/** Un punto no se monta sobre un jugador ni el balón (la letra taparía su número). */
export const MIN_SPOT_TO_PIECE = 10;
/** Ni queda cortado por el borde de la vista. */
const SPOT_INSET = 6;

const MAX_PIECES = 22;
const MAX_LABEL = 3;

/** Problemas de una pizarra (cada uno impide publicar el banco). */
export function boardIssues(board: ExamBoard, optionCount: number): string[] {
  const problems: string[] = [];
  const [vx, vy, vw, vh] = BOARD_VIEWBOX[board.view] ?? BOARD_VIEWBOX.full;
  const inView = (p: BoardPoint) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= vx &&
    p.x <= vx + vw &&
    p.y >= vy &&
    p.y <= vy + vh;

  if (!(board.view in BOARD_VIEWBOX)) problems.push(`Vista desconocida: ${board.view}.`);
  if (board.pieces.length > MAX_PIECES) {
    problems.push(`Tiene ${board.pieces.length} jugadores; caben ${MAX_PIECES}.`);
  }
  if (board.pieces.filter((p) => p.you).length > 1) problems.push('Hay más de un "tú".');
  for (const piece of board.pieces) {
    if (!inView(piece))
      problems.push(`Un jugador queda fuera de la vista (${piece.x}, ${piece.y}).`);
    if (piece.label !== undefined && (!piece.label.trim() || piece.label.length > MAX_LABEL)) {
      problems.push(`La etiqueta "${piece.label}" va de 1 a ${MAX_LABEL} caracteres.`);
    }
  }
  if (board.ball && !inView(board.ball)) problems.push('El balón queda fuera de la vista.');
  for (const arrow of board.arrows ?? []) {
    if (!inView(arrow.from) || !inView(arrow.to)) problems.push('Una flecha sale de la vista.');
  }
  const spots = board.spots ?? [];
  if (spots.length > 0) {
    if (spots.length !== optionCount) {
      problems.push(`Tiene ${spots.length} puntos de respuesta para ${optionCount} opciones.`);
    }
    const insetView = (p: BoardPoint) =>
      p.x >= vx + SPOT_INSET &&
      p.x <= vx + vw - SPOT_INSET &&
      p.y >= vy + SPOT_INSET &&
      p.y <= vy + vh - SPOT_INSET;
    spots.forEach((s, i) => {
      if (!insetView(s)) {
        problems.push(`El punto de respuesta ${i + 1} queda en el borde de la vista (se corta).`);
      }
      const things = [...board.pieces, ...(board.ball ? [board.ball] : [])];
      if (things.some((t) => Math.hypot(t.x - s.x, t.y - s.y) < MIN_SPOT_TO_PIECE)) {
        problems.push(
          `El punto de respuesta ${i + 1} tapa a un jugador o al balón (mínimo ${MIN_SPOT_TO_PIECE}).`,
        );
      }
    });
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        if (Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y) < MIN_SPOT_DISTANCE) {
          problems.push(
            `Los puntos de respuesta ${i + 1} y ${j + 1} están muy juntos (mínimo ${MIN_SPOT_DISTANCE}).`,
          );
        }
      }
    }
  }
  return problems;
}
