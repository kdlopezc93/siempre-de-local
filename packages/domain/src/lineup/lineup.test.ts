import { describe, expect, it } from 'vitest';

import { ELIGIBLE_POSITIONS, type PositionCode } from '../positions.js';
import { seededRandom } from '../test-support/random.js';
import { fit, knowledgeSignal, MODE_WEIGHTS, signalsFor, type PlayerSignals } from './fit.js';
import { DEFAULT_FORMATION, findFormation, FORMATIONS, formationsFor } from './formations.js';
import { assign } from './hungarian.js';
import { lineRatings, solveLineup } from './solve-lineup.js';

/** El mínimo por fuerza bruta (todas las permutaciones). */
function bruteForce(cost: number[][]): number {
  const rows = cost.length;
  const cols = cost[0]!.length;
  let best = Infinity;
  const go = (r: number, used: Set<number>, acc: number) => {
    if (r === rows) return void (best = Math.min(best, acc));
    let any = false;
    for (let c = 0; c < cols; c++) {
      if (used.has(c)) continue;
      any = true;
      used.add(c);
      go(r + 1, used, acc + cost[r]![c]!);
      used.delete(c);
    }
    // Más filas que columnas: esta fila puede quedar sin columna.
    if (!any || rows > cols) go(r + 1, used, acc);
  };
  go(0, new Set(), 0);
  return best;
}

describe('húngaro', () => {
  it('da el mínimo, igual que la fuerza bruta, en 300 matrices al azar', () => {
    const rng = seededRandom(7);
    for (let t = 0; t < 300; t++) {
      const rows = 1 + Math.floor(rng() * 6);
      const cols = 1 + Math.floor(rng() * 6);
      const cost = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => Math.round(rng() * 100) / 100),
      );
      const colOfRow = assign(cost);
      const used = colOfRow.filter((c) => c !== -1);
      expect(new Set(used).size).toBe(used.length);
      expect(used.length).toBe(Math.min(rows, cols));
      const total = colOfRow.reduce((s, c, r) => (c === -1 ? s : s + cost[r]![c]!), 0);
      if (rows <= cols) expect(total).toBeCloseTo(bruteForce(cost), 9);
      else {
        // Con más filas, la traspuesta: el mínimo eligiendo qué filas quedan fuera.
        const transposed = Array.from({ length: cols }, (_, c) => cost.map((r) => r[c]!));
        expect(total).toBeCloseTo(bruteForce(transposed), 9);
      }
    }
  });
});

describe('formaciones', () => {
  it('cada una tiene los jugadores de su formato, puestos válidos e ids únicos', () => {
    for (const f of FORMATIONS) {
      expect(f.slots, f.key).toHaveLength(f.format === 'F8' ? 8 : 11);
      expect(new Set(f.slots.map((s) => s.id)).size, f.key).toBe(f.slots.length);
      expect(
        f.slots.filter((s) => s.position === 'POR'),
        f.key,
      ).toHaveLength(1);
      for (const s of f.slots) expect(ELIGIBLE_POSITIONS[f.format], f.key).toContain(s.position);
    }
    expect(formationsFor('F8').map((f) => f.key)).toEqual([
      '1-3-3-1',
      '1-2-4-1',
      '1-3-4',
      '1-2-3-2',
    ]);
    expect(findFormation(DEFAULT_FORMATION.F11)?.format).toBe('F11');
    expect(findFormation('1-4-4-2')!.slots.map((s) => s.id)).toContain('DFC-2');
  });
});

describe('encaje (02 §9.1)', () => {
  it('conocimiento corregido por azar: 25% → 0, 50% → 0,33, 70% → 0,60, 85% → 0,80', () => {
    expect(
      [0.25, 0.5, 0.7, 0.85, 1].map((p) => Math.round(knowledgeSignal(p) * 100) / 100),
    ).toEqual([0, 0.33, 0.6, 0.8, 1]);
    expect(knowledgeSignal(0.1)).toBe(0);
  });

  it('valoración: principal 1, secundaria 0,6, otra 0; sin examen o re-evaluación vencida, C = 0', () => {
    const p: PlayerSignals = {
      playerId: 'a',
      assessment: { primary: 'DFC', secondary: ['MCD'] },
      knowledge: {
        DFC: { pct: 0.85, reviewExpired: false },
        MCD: { pct: 0.9, reviewExpired: true },
      },
    };
    const dfc = signalsFor(p, 'DFC');
    expect(dfc.V).toBe(1);
    expect(dfc.C).toBeCloseTo(0.8, 10);
    expect(signalsFor(p, 'MCD')).toEqual({ V: 0.6, C: 0 });
    expect(signalsFor(p, 'DC')).toEqual({ V: 0, C: 0 });
  });

  it('renormaliza sobre las señales disponibles', () => {
    const p: PlayerSignals = { playerId: 'a', rating: { EXT: 99 } };
    // Solo R (1) y C (0): equilibrado = (.35·1 + .20·0) / (.35 + .20).
    expect(fit(p, 'EXT', MODE_WEIGHTS.balanced).fit).toBeCloseTo(0.35 / 0.55, 10);
  });
});

/** Un jugador "de" una posición: valorado ahí, con buena tarjeta ahí. */
const of = (
  id: string,
  primary: PositionCode,
  extra: Partial<PlayerSignals> = {},
): PlayerSignals => ({
  playerId: id,
  assessment: { primary, secondary: [] },
  rating: { [primary]: 80 },
  ...extra,
});

describe('armado (02 §9.3)', () => {
  const f8 = findFormation('1-3-3-1')!;
  const squad = [
    of('por', 'POR'),
    of('lat1', 'LAT'),
    of('lat2', 'LAT'),
    of('dfc', 'DFC'),
    of('ext1', 'EXT'),
    of('ext2', 'EXT'),
    of('mc', 'MC'),
    of('dc', 'DC'),
    of('sup', 'MC', { rating: { MC: 50 } }),
  ];

  it('pone a cada uno en su puesto y deja de suplente al que encaja peor', () => {
    const { assignments, bench, warnings } = solveLineup({
      formation: f8,
      players: squad,
      weights: MODE_WEIGHTS.balanced,
    });
    const at = Object.fromEntries(assignments.map((a) => [a.slotId, a.playerId]));
    expect(at['POR']).toBe('por');
    expect(at['DFC']).toBe('dfc');
    expect(at['MC']).toBe('mc');
    expect(at['DC']).toBe('dc');
    expect(new Set([at['LAT-1'], at['LAT-2']])).toEqual(new Set(['lat1', 'lat2']));
    expect(bench).toEqual(['sup']);
    expect(warnings).toEqual([]);
    expect(lineRatings(f8, assignments).defensa).toBeGreaterThan(50);
  });

  it('respeta a los fijados aunque encajen peor', () => {
    const { assignments } = solveLineup({
      formation: f8,
      players: squad,
      weights: MODE_WEIGHTS.balanced,
      pins: [{ slotId: 'MC', playerId: 'sup' }],
    });
    expect(assignments.find((a) => a.slotId === 'MC')).toMatchObject({
      playerId: 'sup',
      pinned: true,
    });
    expect(assignments.map((a) => a.playerId)).not.toContain('mc');
  });

  it('conocimiento mínimo: evita a quien no lo cumple si hay alternativa; si no, avisa', () => {
    const withKnowledge = squad.map((p) =>
      p.playerId === 'sup' ? { ...p, knowledge: { MC: { pct: 0.9, reviewExpired: false } } } : p,
    );
    const ok = solveLineup({
      formation: f8,
      players: withKnowledge,
      weights: MODE_WEIGHTS.balanced,
      minKnowledgePct: 0.7,
    });
    // En MC entra el único que supera el 70%, aunque su tarjeta sea peor.
    expect(ok.assignments.find((a) => a.slotId === 'MC')!.playerId).toBe('sup');
    // Para el resto de puestos nadie lo cumple: se avisa y se arma igual.
    expect(ok.warnings.filter((w) => w.code === 'MIN_KNOWLEDGE_INFEASIBLE')).toHaveLength(7);
  });

  it('priorizar una línea la arma primero con toda la plantilla', () => {
    // El central titular es flojo (tarjeta 60). El crack es 9, pero también lo ven de
    // central (secundaria) y ahí encaja apenas mejor que el titular.
    const crack: PlayerSignals = {
      playerId: 'crack',
      assessment: { primary: 'DC', secondary: ['DFC'] },
      rating: { DC: 95, DFC: 85 },
    };
    const players = [
      ...squad.filter((p) => p.playerId !== 'dc' && p.playerId !== 'dfc'),
      of('dfc', 'DFC', { rating: { DFC: 60 } }),
      crack,
    ];
    const base = solveLineup({ formation: f8, players, weights: MODE_WEIGHTS.performance });
    const defensa = solveLineup({
      formation: f8,
      players,
      weights: MODE_WEIGHTS.performance,
      priority: 'defensa',
    });
    expect(base.assignments.find((a) => a.slotId === 'DC')!.playerId).toBe('crack');
    expect(defensa.assignments.find((a) => a.slotId === 'DFC')!.playerId).toBe('crack');
  });

  it('avisa si faltan jugadores, si alguien no tiene datos o tiene una re-evaluación vencida', () => {
    const players: PlayerSignals[] = [
      of('por', 'POR'),
      { playerId: 'nuevo' },
      of('dfc', 'DFC', { knowledge: { DFC: { pct: 0.8, reviewExpired: true } } }),
    ];
    const { assignments, warnings } = solveLineup({
      formation: f8,
      players,
      weights: MODE_WEIGHTS.balanced,
    });
    expect(assignments.filter((a) => a.playerId)).toHaveLength(3);
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'NOT_ENOUGH_PLAYERS', missing: 5 },
        { code: 'PLAYER_WITHOUT_DATA', playerId: 'nuevo' },
        { code: 'KNOWLEDGE_REVIEW_EXPIRED', playerId: 'dfc', slotId: 'DFC' },
      ]),
    );
  });

  it('es determinista', () => {
    const run = () =>
      solveLineup({
        formation: findFormation('1-4-3-3')!,
        players: squad,
        weights: MODE_WEIGHTS.development,
      });
    expect(run()).toEqual(run());
  });
});
