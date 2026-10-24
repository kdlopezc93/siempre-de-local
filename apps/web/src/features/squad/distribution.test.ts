import type { SquadPlayer } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { distribution } from './distribution';

const player = (over: Partial<SquadPlayer>): SquadPlayer => ({
  userId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
  displayName: 'X',
  jerseyNumber: null,
  preferredPositions: [],
  test: { status: 'none' },
  latestAssessment: null,
  assessedByMe: false,
  canRate: true,
  knowledge: [],
  card: null,
  ...over,
});

const assessed = (primaryPosition: SquadPlayer['preferredPositions'][number]) =>
  player({
    latestAssessment: {
      id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71',
      playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
      assessor: null,
      primaryPosition,
      secondaryPositions: [],
      confidence: 3,
      blind: true,
      notes: null,
      createdAt: '2026-10-22T10:00:00.000Z',
    },
  });

describe('distribution', () => {
  it('cuenta por posición y marca los huecos del formato', () => {
    const { roster, gaps, unknown } = distribution(
      [assessed('DFC'), assessed('DFC'), assessed('POR'), player({})],
      'staff',
      'F11',
    );
    expect(roster.DFC).toEqual(['X', 'X']);
    expect(roster.POR).toEqual(['X']);
    expect(gaps).toEqual(['LAT', 'MCD', 'MC', 'MP', 'EXT', 'DC']);
    expect(unknown).toBe(1);
  });

  it('en F8 el pivote cuenta como mediocentro y la mediapunta como delantero', () => {
    const { roster, gaps } = distribution([assessed('MCD'), assessed('MP')], 'staff', 'F8');
    expect(roster).toEqual({ POR: [], LAT: [], DFC: [], MC: ['X'], EXT: [], DC: ['X'] });
    expect(gaps).toEqual(['POR', 'LAT', 'DFC', 'EXT']);
  });

  it('el test oculto no cuenta (para no destapar lo que aún no se valoró)', () => {
    const hidden = player({ test: { status: 'hidden' } });
    const visible = player({
      test: {
        status: 'visible',
        attemptId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72',
        submittedAt: '2026-10-22T10:00:00.000Z',
        podium: ['EXT', 'DC', 'MP'],
      },
    });
    const { roster, unknown } = distribution([hidden, visible], 'test', 'F11');
    expect(roster.EXT).toHaveLength(1);
    expect(unknown).toBe(1);
  });

  it('las preferidas usan la primera de cada jugador', () => {
    const { roster } = distribution(
      [player({ preferredPositions: ['LAT', 'EXT'] })],
      'preferred',
      'F11',
    );
    expect(roster.LAT).toEqual(['X']);
    expect(roster.EXT).toEqual([]);
  });
});
