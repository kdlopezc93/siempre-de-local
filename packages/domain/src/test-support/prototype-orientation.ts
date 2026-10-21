/**
 * Oráculo de paridad: `computeWinner` de docs/prototipo/detector-posicion.jsx copiado
 * casi literal (solo tipos y sin estado de React). No se usa fuera de los tests.
 */

const ORDER = ['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC'];
const F8_ELIGIBLE = ['POR', 'LAT', 'DFC', 'MC', 'EXT', 'DC'];
const F8_FOLD: Record<string, string> = { MCD: 'MC', MP: 'DC' };

export interface PrototypeOption {
  label: string;
  pts: Record<string, number>;
}

export interface PrototypeQuestion {
  id: string;
  options: PrototypeOption[];
}

export function prototypeComputeWinner(
  posQuestions: PrototypeQuestion[],
  answers: PrototypeOption[],
  format: '8' | '11',
): { pos: string; pct: number }[] {
  const eligible = format === '8' ? F8_ELIGIBLE : ORDER;
  const earned: Record<string, number> = {};
  const maxp: Record<string, number> = {};
  ORDER.forEach((p) => {
    earned[p] = 0;
    maxp[p] = 0;
  });
  posQuestions.forEach((q, i) => {
    ORDER.forEach((p) => {
      let best = 0;
      q.options.forEach((o) => {
        if ((o.pts[p] || 0) > best) best = o.pts[p] || 0;
      });
      maxp[p]! += best;
    });
    const chosen = answers[i];
    if (chosen)
      ORDER.forEach((p) => {
        earned[p]! += chosen.pts[p] || 0;
      });
  });

  if (format === '8') {
    Object.entries(F8_FOLD).forEach(([from, to]) => {
      earned[to]! += earned[from]!;
      maxp[to]! += maxp[from]!;
    });
  }

  return eligible
    .map((p) => ({ pos: p, pct: maxp[p]! > 0 ? earned[p]! / maxp[p]! : 0 }))
    .sort((a, b) => b.pct - a.pct);
}
