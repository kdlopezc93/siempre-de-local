import type { PositionCode } from './positions.js';

/**
 * Validación interna (02 §11): ¿el test acierta con lo que ve el cuerpo técnico? ¿quien más
 * sabe de una posición tiene mejor tarjeta ahí? Muestras chicas: se dice cuántos datos hay.
 */

export interface BlindPair {
  /** Principal de la valoración a ciegas. */
  staff: PositionCode;
  /** Podio del test del jugador (la primera es la que más encaja). */
  podium: readonly PositionCode[];
}

export interface TestVsStaff {
  n: number;
  /** La primera del test es la principal del cuerpo técnico. */
  exact: number;
  /** La principal del cuerpo técnico está en el podio. */
  inPodium: number;
  /** Cuántas veces el cuerpo técnico vio `staff` y el test dio `test` primera, de más a menos. */
  confusion: { staff: PositionCode; test: PositionCode; count: number }[];
}

export function testVsStaff(pairs: readonly BlindPair[]): TestVsStaff {
  const counts = new Map<string, { staff: PositionCode; test: PositionCode; count: number }>();
  let exact = 0;
  let inPodium = 0;
  for (const { staff, podium } of pairs) {
    const test = podium[0];
    if (!test) continue;
    if (test === staff) exact++;
    if (podium.includes(staff)) inPodium++;
    const key = `${staff}>${test}`;
    const entry = counts.get(key) ?? { staff, test, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return {
    n: pairs.filter((p) => p.podium.length > 0).length,
    exact,
    inPodium,
    confusion: [...counts.values()].sort(
      (a, b) => b.count - a.count || a.staff.localeCompare(b.staff) || a.test.localeCompare(b.test),
    ),
  };
}

/** Rangos 1..n con empates promediados. */
function ranks(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]![1]] = rank;
    i = j + 1;
  }
  return out;
}

/**
 * Correlación de Spearman (Pearson sobre rangos, con empates): aguanta mejor que Pearson las
 * muestras chicas y los valores raros. null si hay menos de 3 datos o una de las dos no varía.
 */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

/** Con menos de esto, la correlación no dice nada todavía. */
export const MIN_PAIRS_FOR_CORRELATION = 5;

export type Strength = 'strong' | 'moderate' | 'weak' | 'none';

/** En palabras, para la pantalla (umbrales usuales para |ρ|). */
export function strengthOf(rho: number): Strength {
  const a = Math.abs(rho);
  if (a >= 0.6) return 'strong';
  if (a >= 0.4) return 'moderate';
  if (a >= 0.2) return 'weak';
  return 'none';
}
