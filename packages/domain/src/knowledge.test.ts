import { describe, expect, it } from 'vitest';

import { lintBank, type BankDraft } from './bank-lint.js';
import {
  bandFor,
  bestKnowledge,
  canStartExam,
  DEFAULT_EXAM_CONFIG,
  difficultyQuotas,
  nextAttemptFrom,
  scoreExam,
  selectExamItems,
  type BankItem,
  type Difficulty,
  type ExamSummary,
} from './knowledge.js';
import { seededRandom } from './test-support/random.js';

const cfg = DEFAULT_EXAM_CONFIG;
const AREAS = ['marcaje', 'linea', 'aereo', 'salida', 'parado', 'coberturas'];

/** 60 ítems: 10 por área, dificultades 1/2/3 en proporción 3/5/2. */
const BANK: BankItem[] = AREAS.flatMap((area) =>
  Array.from({ length: 10 }, (_, i) => ({
    id: `${area}-${i}`,
    area,
    difficulty: ([1, 1, 1, 2, 2, 2, 2, 2, 3, 3] as const)[i]!,
  })),
);

describe('selección del examen', () => {
  it('cupos por dificultad: 6 · 10 · 4 de 20', () => {
    expect(difficultyQuotas(cfg)).toEqual({ 1: 6, 2: 10, 3: 4 });
    expect(difficultyQuotas({ ...cfg, itemsPerExam: 7 })).toEqual({ 1: 2, 2: 4, 3: 1 });
  });

  it('20 ítems distintos, todas las áreas y la mezcla de dificultad', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const items = selectExamItems(BANK, new Set(), cfg, seededRandom(seed));
      expect(new Set(items.map((i) => i.id)).size).toBe(20);
      expect(new Set(items.map((i) => i.area))).toEqual(new Set(AREAS));
      const count = (d: Difficulty) => items.filter((i) => i.difficulty === d).length;
      expect([count(1), count(2), count(3)]).toEqual([6, 10, 4]);
    }
  });

  it('prioriza lo no visto: tres exámenes seguidos de un banco de 60 no repiten', () => {
    const seen = new Set<string>();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const items = selectExamItems(BANK, seen, cfg, seededRandom(attempt * 7));
      for (const item of items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
    }
    expect(seen.size).toBe(60);
    // El cuarto ya tiene que repetir, pero sigue dando 20.
    expect(selectExamItems(BANK, seen, cfg, seededRandom(99))).toHaveLength(20);
  });

  it('si una dificultad no alcanza, completa con las otras', () => {
    const easyOnly = BANK.map((i) => ({ ...i, difficulty: 1 as const }));
    expect(selectExamItems(easyOnly, new Set(), cfg, seededRandom(3))).toHaveLength(20);
  });

  it('es reproducible con la misma semilla', () => {
    const a = selectExamItems(BANK, new Set(), cfg, seededRandom(42)).map((i) => i.id);
    const b = selectExamItems(BANK, new Set(), cfg, seededRandom(42)).map((i) => i.id);
    expect(a).toEqual(b);
  });
});

describe('puntaje', () => {
  const items = [
    { id: 'a', area: 'marcaje', correctOptionId: 'a1' },
    { id: 'b', area: 'marcaje', correctOptionId: 'b1' },
    { id: 'c', area: 'aereo', correctOptionId: 'c1' },
  ];

  it('cuenta aciertos, desglosa por área y lo no respondido es fallo', () => {
    const result = scoreExam(
      items,
      new Map([
        ['a', 'a1'],
        ['b', 'b2'],
      ]),
    );
    expect(result).toEqual({
      score: 1,
      total: 3,
      pct: 0.333,
      band: 'insufficient',
      byArea: [
        { area: 'marcaje', correct: 1, total: 2 },
        { area: 'aereo', correct: 0, total: 1 },
      ],
    });
  });

  it('bandas (02 §6.4)', () => {
    expect([0.85, 0.84, 0.7, 0.69, 0.5, 0.49].map(bandFor)).toEqual([
      'mastery',
      'solid',
      'solid',
      'developing',
      'developing',
      'insufficient',
    ]);
  });
});

const day = (d: number) => new Date(Date.UTC(2026, 9, d));
const exam = (over: Partial<ExamSummary>): ExamSummary => ({
  id: 'x',
  position: 'DFC',
  status: 'submitted',
  pct: 0.5,
  startedAt: day(1),
  submittedAt: day(1),
  nextAttemptAt: nextAttemptFrom(day(1), cfg),
  underReview: false,
  superseded: false,
  voidResetsInterval: false,
  ...over,
});

describe('mejor puntaje', () => {
  it('cuenta el mejor válido; ignora anulados, vencidos, sustituidos y otras posiciones', () => {
    const exams = [
      exam({ id: 'bajo', pct: 0.6 }),
      exam({ id: 'alto', pct: 0.8, submittedAt: day(2) }),
      exam({ id: 'anulado', status: 'void', pct: 0.95 }),
      exam({ id: 'sustituido', pct: 0.9, superseded: true }),
      exam({ id: 'vencido', status: 'expired', pct: null }),
      exam({ id: 'otra', position: 'MC', pct: 1 }),
    ];
    expect(bestKnowledge(exams, 'DFC')).toEqual({
      examId: 'alto',
      pct: 0.8,
      band: 'solid',
      underReview: false,
    });
    expect(bestKnowledge([], 'DFC')).toBeNull();
  });

  it('empate: el más reciente', () => {
    const exams = [
      exam({ id: 'viejo', pct: 0.7, submittedAt: day(1) }),
      exam({ id: 'nuevo', pct: 0.7, submittedAt: day(5) }),
    ];
    expect(bestKnowledge(exams, 'DFC')?.examId).toBe('nuevo');
  });
});

describe('cuándo se puede presentar', () => {
  const none = { pendingReview: false };

  it('la primera vez, sí; después, un intento por posición cada 30 días desde el inicio', () => {
    expect(canStartExam([], 'DFC', day(1), none)).toEqual({ ok: true });
    const last = exam({});
    expect(canStartExam([last], 'DFC', day(20), none)).toEqual({
      ok: false,
      reason: 'ATTEMPT_INTERVAL',
      nextAttemptAt: day(31),
    });
    expect(canStartExam([last], 'DFC', day(31), none)).toEqual({ ok: true });
    // Otra posición no espera.
    expect(canStartExam([last], 'MC', day(2), none)).toEqual({ ok: true });
  });

  it('el intento cuenta aunque se haya vencido o abandonado', () => {
    expect(
      canStartExam([exam({ status: 'expired', pct: null })], 'DFC', day(5), none),
    ).toMatchObject({
      ok: false,
    });
  });

  it('sin espera: "a revisar", anulado con reinicio o re-evaluación pendiente', () => {
    expect(canStartExam([exam({ underReview: true })], 'DFC', day(2), none)).toEqual({ ok: true });
    expect(
      canStartExam([exam({ status: 'void', voidResetsInterval: true })], 'DFC', day(2), none),
    ).toEqual({ ok: true });
    expect(canStartExam([exam({ status: 'void' })], 'DFC', day(2), none)).toMatchObject({
      ok: false,
    });
    expect(canStartExam([exam({})], 'DFC', day(2), { pendingReview: true })).toEqual({ ok: true });
  });

  it('un reemplazado no marca la espera: anular con reinicio la re-evaluación deja presentar', () => {
    const replaced = exam({ id: 'viejo', superseded: true });
    const voidedReview = exam({
      id: 'reeval',
      status: 'void',
      voidResetsInterval: true,
      startedAt: day(3),
      nextAttemptAt: nextAttemptFrom(day(3), cfg),
    });
    expect(canStartExam([replaced, voidedReview], 'DFC', day(4), none)).toEqual({ ok: true });
    // Sin reinicio, la re-evaluación anulada sí marca su espera.
    expect(
      canStartExam([replaced, { ...voidedReview, voidResetsInterval: false }], 'DFC', day(4), none),
    ).toMatchObject({ ok: false, nextAttemptAt: nextAttemptFrom(day(3), cfg) });
  });

  it('un examen activo a la vez, de cualquier posición', () => {
    expect(
      canStartExam([exam({ id: 'activo', status: 'in_progress', position: 'MC' })], 'DFC', day(2), {
        pendingReview: true,
      }),
    ).toEqual({ ok: false, reason: 'EXAM_IN_PROGRESS', examId: 'activo' });
  });
});

describe('lint del banco', () => {
  const option = (label: string, correct = false) => ({ label, correct });
  const draft = (count: number): BankDraft => ({
    areas: AREAS.map((code) => ({ code, name: code })),
    items: Array.from({ length: count }, (_, i) => ({
      code: `I${i}`,
      area: AREAS[i % AREAS.length]!,
      difficulty: ([1, 1, 1, 2, 2, 2, 2, 2, 3, 3] as const)[i % 10]!,
      text: `Situación ${i}`,
      // La correcta va rotando de largo: no es siempre la más larga.
      options:
        i % 2
          ? [
              option('Corta'),
              option('Bastante más larga que la otra', true),
              option('Media x'),
              option('Otra'),
            ]
          : [
              option('Larga de verdad mucha'),
              option('Corta', true),
              option('Media x'),
              option('Otra'),
            ],
      explanation: 'Porque sí.',
    })),
  });
  const rules = (issues: ReturnType<typeof lintBank>) => issues.map((i) => `${i.level}:${i.rule}`);

  it('un banco bien armado de 60 pasa sin errores', () => {
    expect(lintBank(draft(60), cfg).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('menos de 40 no se publica', () => {
    expect(rules(lintBank(draft(30), cfg))).toContain('error:min-items');
  });

  it('estructura: 4 opciones, una correcta, sin repetidos, con explicación y área', () => {
    const bank = draft(60);
    const items = [...bank.items];
    items[0] = { ...items[0]!, options: items[0]!.options.slice(0, 3) };
    items[1] = { ...items[1]!, options: items[1]!.options.map((o) => ({ ...o, correct: true })) };
    items[2] = { ...items[2]!, explanation: ' ', area: 'otra' };
    items[3] = { ...items[3]!, text: items[4]!.text };
    expect(rules(lintBank({ ...bank, items }, cfg))).toEqual(
      expect.arrayContaining([
        'error:four-options',
        'error:one-correct',
        'error:empty-explanation',
        'error:unknown-area',
        'error:duplicate-text',
      ]),
    );
  });

  it('avisa si la correcta es casi siempre la más larga o un distractor usa absolutos', () => {
    const bank = draft(60);
    const items = bank.items.map((item, i) => ({
      ...item,
      options: [
        option('La respuesta correcta y larguísima de verdad', true),
        option(i === 0 ? 'Nunca sale de su zona' : 'Corta'),
        option('Media'),
        option('Otra'),
      ],
    }));
    const issues = rules(lintBank({ ...bank, items }, cfg));
    expect(issues).toContain('warning:longest-correct');
    expect(issues).toContain('warning:absolute-distractor');
  });

  it('cada dificultad debe alcanzar su cupo y cada área tener ítems', () => {
    const bank = draft(60);
    const items = bank.items.map((item) => ({ ...item, difficulty: 2 as const }));
    const issues = rules(
      lintBank({ ...bank, areas: [...bank.areas, { code: 'x', name: 'x' }], items }, cfg),
    );
    expect(issues).toContain('error:difficulty-mix');
    expect(issues).toContain('error:empty-area');
  });
});
