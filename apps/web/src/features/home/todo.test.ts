import { describe, expect, it } from 'vitest';

import { arrange, lastLineup, matchTodos, playerTodos, staffTodos } from './todo';

const NOW = new Date('2026-10-22T12:00:00Z');
const bank = {
  label: 'v1',
  itemsPerExam: 20,
  timeLimitSeconds: 1200,
  attemptIntervalDays: 30,
  areas: [],
};
const position = (over: object) => ({
  position: 'DFC' as const,
  bank,
  best: null,
  review: null,
  nextAttemptAt: null,
  activeExamId: null,
  ...over,
});
const review = (status: 'pending' | 'expired') => ({
  id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f80',
  position: 'DFC' as const,
  reason: 'Revisemos',
  requestedAt: '2026-10-01T12:00:00Z',
  dueAt: '2026-10-15T12:00:00Z',
  status,
  requestedBy: null,
  resolvedExamId: null,
});

describe('lo que toca al jugador', () => {
  it('el examen a medias va primero; después la re-evaluación vencida y el test', () => {
    const todos = playerTodos({
      teamId: 't1',
      testDone: false,
      now: NOW,
      positions: [
        position({ review: review('expired') }),
        position({ position: 'MC', activeExamId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f81' }),
      ],
    });
    const { lead, rest } = arrange(todos);
    expect(lead).toMatchObject({
      id: 'exam-active',
      to: '/conocimiento/examen/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f81',
    });
    expect(rest.map((t) => t.id)).toEqual(['review-DFC', 'test']);
    expect(rest[0]!.detail).toBe('Venció el 15 oct');
  });

  it('exámenes que ya puede presentar o repetir; los que esperan el mes, no', () => {
    const todos = playerTodos({
      teamId: 't1',
      testDone: true,
      now: NOW,
      positions: [
        position({ best: { pct: 0.4 }, nextAttemptAt: '2026-10-20T00:00:00Z' }),
        position({ position: 'MC', best: { pct: 0.6 }, nextAttemptAt: '2026-11-20T00:00:00Z' }),
        position({ position: 'POR' }),
      ],
    });
    expect(todos.map((t) => t.title)).toEqual([
      'Ya puedes repetir el examen de Defensa central',
      'Presenta el examen de Portero',
    ]);
  });
});

describe('lo que toca al cuerpo técnico', () => {
  const player = (over: object) => ({
    userId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f90',
    displayName: 'Ana',
    jerseyNumber: 4,
    preferredPositions: [],
    test: { status: 'none' as const },
    latestAssessment: null,
    assessedByMe: true,
    knowledge: [],
    card: { ratedAt: '2026-10-01T00:00:00Z', positionAverages: {} },
    ...over,
  });

  it('valorar primero (a ciegas), y los conteos de lo que falta', () => {
    const todos = staffTodos({
      teamId: 't1',
      squad: [
        player({ assessedByMe: false }),
        player({ assessedByMe: false, card: null }),
        player({
          test: { status: 'hidden' },
          knowledge: [{ position: 'DFC', pct: 0.4, band: 'insufficient', review: 'expired' }],
        }),
      ],
    });
    const { lead, rest } = arrange(todos);
    expect(lead).toMatchObject({
      title: 'Valora a 2 jugadores',
      detail: 'Antes de mirar su test',
      to: '/equipos/t1/plantilla?filtro=por-valorar',
    });
    expect(rest.map((t) => [t.short, t.count])).toEqual([
      ['Re-evaluación vencida', 1],
      ['Sin tarjeta', 1],
      ['Sin test', 2],
    ]);
  });

  it('con todo al día no hay pendientes; la última alineación es un atajo', () => {
    expect(staffTodos({ teamId: 't1', squad: [player({ test: { status: 'hidden' } })] })).toEqual(
      [],
    );
    expect(
      lastLineup('t1', [
        {
          id: 'a',
          name: 'Fecha 2',
          matchDate: null,
          matchId: null,
          formation: '1-4-3-3',
          createdBy: null,
          updatedAt: '2026-10-10T00:00:00Z',
        },
        {
          id: 'b',
          name: 'Fecha 3',
          matchDate: null,
          matchId: null,
          formation: '1-4-3-3',
          createdBy: null,
          updatedAt: '2026-10-20T00:00:00Z',
        },
      ]),
    ).toMatchObject({ title: 'Última alineación: Fecha 3', to: '/equipos/t1/alineaciones/b' });
  });
});

describe('lo que toca: partidos (D16)', () => {
  const m = (id: string, startsAt: string, over: object = {}) => ({
    id,
    format: 'F11' as const,
    startsAt,
    place: 'La 14',
    opponent: id,
    status: 'scheduled' as const,
    open: true,
    createdBy: null,
    replies: { yes: 1, no: 0, pending: 3 },
    myReply: null,
    published: null,
    result: null,
    myRating: null,
    ...over,
  });

  it('al jugador, las convocatorias sin responder; al cuerpo técnico, el próximo con gente sin responder', () => {
    const matches = [
      m('Pibes', '2026-11-01T15:00:00.000Z'),
      m('Veteranos', '2026-11-08T15:00:00.000Z', { myReply: 'yes' }),
      m('Cancelado', '2026-11-02T15:00:00.000Z', { open: false, status: 'cancelled' }),
      m('Publicado', '2026-11-03T15:00:00.000Z', {
        myReply: 'yes',
        replies: { yes: 1, no: 0, pending: 0 },
        published: { lineupId: 'l1', at: '2026-10-30T15:00:00.000Z' },
      }),
    ];
    const todos = matchTodos({ teamId: 't1', matches, player: true, staff: true });
    expect(todos.map((t) => [t.who, t.title])).toEqual([
      ['player', 'Te convocaron: Pibes'],
      ['player', 'Ya está la alineación: Publicado'],
      ['staff', 'Pibes: 3 jugadores sin responder'],
    ]);
    expect(arrange(todos).lead!.to).toBe('/equipos/t1/partidos/Pibes');
  });

  it('después del partido: al cuerpo técnico, los de la última semana sin resultado (D18)', () => {
    const played = { open: false, replies: { yes: 9, no: 0, pending: 0 } };
    const matches = [
      m('Jugado', '2026-11-01T15:00:00.000Z', played),
      m('Con resultado', '2026-11-02T15:00:00.000Z', {
        ...played,
        result: { goalsFor: 2, goalsAgainst: 1, figure: null, at: '2026-11-02T18:00:00.000Z' },
      }),
      m('Viejo', '2026-10-20T15:00:00.000Z', played),
      m('Cancelado', '2026-11-03T15:00:00.000Z', { ...played, status: 'cancelled' }),
    ];
    const now = new Date('2026-11-04T12:00:00.000Z');
    const staff = matchTodos({ teamId: 't1', matches, player: false, staff: true, now });
    expect(staff.map((t) => t.title)).toEqual(['¿Cómo salió contra Jugado?']);
    // Al jugador no le toca cargarlo; sí ve el que ya tiene resultado.
    expect(
      matchTodos({ teamId: 't1', matches, player: true, staff: false, now }).map((t) => t.title),
    ).toEqual(['Con resultado: 2 a 1']);
  });

  it('al jugador, el resultado de los últimos 3 días; si fue la figura, arriba (D18)', () => {
    const result = (figure: string | null) => ({
      goalsFor: 2,
      goalsAgainst: 1,
      figure: figure ? { id: figure, displayName: 'Ana', jerseyNumber: 4 } : null,
      at: '2026-11-02T18:00:00.000Z',
    });
    const played = { open: false };
    const matches = [
      m('Pibes', '2026-11-01T15:00:00.000Z', { ...played, result: result('yo'), myRating: 5 }),
      m('Veteranos', '2026-11-02T15:00:00.000Z', { ...played, result: result(null), myRating: 3 }),
      m('Viejo', '2026-10-20T15:00:00.000Z', {
        ...played,
        result: { ...result(null), at: '2026-10-20T18:00:00.000Z' },
      }),
    ];
    const now = new Date('2026-11-03T12:00:00.000Z');
    const todos = matchTodos({
      teamId: 't1',
      matches,
      player: true,
      staff: false,
      meId: 'yo',
      now,
    });
    expect(todos.map((t) => [t.title, t.detail])).toEqual([
      ['¡Fuiste la figura contra Pibes!', '2 a 1. Felicitaciones.'],
      ['Veteranos: 2 a 1', 'Mira cómo jugaste.'],
    ]);
    expect(arrange(todos).lead!.title).toBe('¡Fuiste la figura contra Pibes!');
  });
});
