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
    const { counts, gaps, unknown } = distribution(
      [assessed('DFC'), assessed('DFC'), assessed('POR'), player({})],
      'staff',
      'F11',
    );
    expect(counts.DFC).toBe(2);
    expect(counts.POR).toBe(1);
    expect(gaps).toEqual(['LAT', 'MCD', 'MC', 'MP', 'EXT', 'DC']);
    expect(unknown).toBe(1);
  });

  it('en F8 el pivote cuenta como mediocentro y la mediapunta como delantero', () => {
    const { counts, gaps } = distribution([assessed('MCD'), assessed('MP')], 'staff', 'F8');
    expect(counts).toEqual({ POR: 0, LAT: 0, DFC: 0, MC: 1, EXT: 0, DC: 1 });
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
    const { counts, unknown } = distribution([hidden, visible], 'test', 'F11');
    expect(counts.EXT).toBe(1);
    expect(unknown).toBe(1);
  });

  it('las preferidas usan la primera de cada jugador', () => {
    const { counts } = distribution(
      [player({ preferredPositions: ['LAT', 'EXT'] })],
      'preferred',
      'F11',
    );
    expect(counts.LAT).toBe(1);
    expect(counts.EXT).toBe(0);
  });
});
