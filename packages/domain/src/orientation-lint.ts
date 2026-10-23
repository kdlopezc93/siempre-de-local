import type { LintIssue } from './bank-lint.js';
import { POSITION_CODES, POSITIONS, type PositionCode } from './positions.js';

/** El banco de posición del test de orientación tal como se escribe (02 §2). */
export interface OrientationDraft {
  positionItemsPerAttempt: number;
  positionItems: readonly {
    code: string;
    context: 'situation' | 'attribute';
    text: string;
    options: readonly { label: string; points: Partial<Record<PositionCode, number>> }[];
  }[];
}

/**
 * Cobertura mínima por posición (02 §2, Fase 8). Una pregunta es **fuerte** para una posición
 * si alguna opción apunta a ella: le da 3 puntos o más y es la que más recibe en esa opción.
 * Con 20 de 40 al azar, 11 fuertes dejan 4 o más en más de 9 de cada 10 intentos (con 10,
 * en el 14 % le tocan 3 o menos).
 */
export const ORIENTATION_COVERAGE = {
  minStrongItems: 11,
  /** Fuertes que le tocan a cada posición en el 10 % de intentos con menos. */
  minStrongPerAttemptP10: 4,
} as const;

export interface PositionCoverage {
  position: PositionCode;
  /** Preguntas en las que alguna opción le da puntos. */
  scoring: number;
  /** Preguntas en las que alguna opción apunta a ella (ver `ORIENTATION_COVERAGE`). */
  strong: number;
  /** Fuertes que le tocan en un intento, en el 10 % de intentos con menos (percentil 10). */
  strongPerAttemptP10: number;
}

const isStrongFor = (points: Partial<Record<PositionCode, number>>, pos: PositionCode) => {
  const own = points[pos] ?? 0;
  return own >= 3 && Object.values(points).every((v) => (v ?? 0) <= own);
};

/** ln(n!) exacto por suma (n ≤ unos cientos: sobra para un banco de preguntas). */
const logFactorial = (n: number) => {
  let sum = 0;
  for (let i = 2; i <= n; i++) sum += Math.log(i);
  return sum;
};
const logChoose = (n: number, k: number) =>
  k < 0 || k > n ? -Infinity : logFactorial(n) - logFactorial(k) - logFactorial(n - k);

/**
 * Percentil de cuántas "marcadas" salen al sacar `draw` de `total` sin reposición, con `marked`
 * marcadas (hipergeométrica exacta): el menor k con P(X ≤ k) ≥ q.
 */
export function hypergeometricQuantile(
  total: number,
  marked: number,
  draw: number,
  q: number,
): number {
  const n = Math.min(draw, total);
  let cumulative = 0;
  for (let k = 0; k <= Math.min(n, marked); k++) {
    cumulative += Math.exp(
      logChoose(marked, k) + logChoose(total - marked, n - k) - logChoose(total, n),
    );
    if (cumulative >= q - 1e-12) return k;
  }
  return Math.min(n, marked);
}

/** Cuántas preguntas suman y apuntan a cada posición, y cuántas le tocan por intento. */
export function orientationCoverage(draft: OrientationDraft): PositionCoverage[] {
  const total = draft.positionItems.length;
  return POSITION_CODES.map((position) => {
    let scoring = 0;
    let strong = 0;
    for (const item of draft.positionItems) {
      if (item.options.some((o) => (o.points[position] ?? 0) > 0)) scoring++;
      if (item.options.some((o) => isStrongFor(o.points, position))) strong++;
    }
    return {
      position,
      scoring,
      strong,
      strongPerAttemptP10: hypergeometricQuantile(
        total,
        strong,
        draft.positionItemsPerAttempt,
        0.1,
      ),
    };
  });
}

/**
 * Reglas de calidad del test de orientación (02 §2). Errores: estructura (4 opciones, cada una
 * da 1 a 5 puntos enteros a 1–3 posiciones, códigos y opciones sin repetir). Avisos: posiciones
 * con pocas preguntas que las favorezcan, que dejan su lugar en el podio al azar del sorteo.
 */
export function lintOrientation(draft: OrientationDraft): LintIssue[] {
  const issues: LintIssue[] = [];
  const error = (rule: string, item: string | null, message: string) =>
    issues.push({ level: 'error', rule, item, message });
  const known = new Set<string>(POSITION_CODES);

  if (draft.positionItems.length < draft.positionItemsPerAttempt) {
    error(
      'min-items',
      null,
      `Tiene ${draft.positionItems.length} preguntas y cada intento sirve ${draft.positionItemsPerAttempt}.`,
    );
  }
  const codes = new Set<string>();
  for (const item of draft.positionItems) {
    if (codes.has(item.code)) error('duplicate-code', item.code, 'Código repetido.');
    codes.add(item.code);
    if (!item.text.trim()) error('empty-text', item.code, 'La pregunta no tiene texto.');
    if (item.options.length !== 4) {
      error('options', item.code, `Tiene ${item.options.length} opciones; van 4.`);
    }
    const labels = new Set<string>();
    for (const option of item.options) {
      const label = option.label.trim().toLowerCase();
      if (!label) error('empty-option', item.code, 'Una opción no tiene texto.');
      if (labels.has(label))
        error('duplicate-option', item.code, `Opción repetida: "${option.label}".`);
      labels.add(label);
      const entries = Object.entries(option.points);
      if (entries.length < 1 || entries.length > 3) {
        error(
          'option-positions',
          item.code,
          `"${option.label}" da puntos a ${entries.length} posiciones; van de 1 a 3.`,
        );
      }
      for (const [pos, value] of entries) {
        if (!known.has(pos)) error('unknown-position', item.code, `Posición desconocida: ${pos}.`);
        if (!Number.isInteger(value) || value! < 1 || value! > 5) {
          error(
            'points',
            item.code,
            `"${option.label}" da ${value} a ${pos}; van de 1 a 5, enteros.`,
          );
        }
      }
    }
  }

  for (const c of orientationCoverage(draft)) {
    if (c.strong < ORIENTATION_COVERAGE.minStrongItems) {
      issues.push({
        level: 'warning',
        rule: 'coverage',
        item: null,
        message: `${POSITIONS[c.position].name}: ${c.strong} preguntas apuntan a esta posición; se buscan ${ORIENTATION_COVERAGE.minStrongItems}.`,
      });
    }
    if (c.strongPerAttemptP10 < ORIENTATION_COVERAGE.minStrongPerAttemptP10) {
      issues.push({
        level: 'warning',
        rule: 'coverage-per-attempt',
        item: null,
        message: `${POSITIONS[c.position].name}: en 1 de cada 10 intentos le tocan ${c.strongPerAttemptP10} o menos; se buscan ${ORIENTATION_COVERAGE.minStrongPerAttemptP10}.`,
      });
    }
  }
  return issues;
}
