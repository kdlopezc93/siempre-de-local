import type { Me } from '../shared/api/auth';
import { DEFAULT_PROFILE } from './me-fixture';

export const TEAM_A = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71';
export const TEAM_B = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f73';
const CLUB = { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72', name: 'Los del Barrio' };

/** Kevin: entrenador y jugador en el primer equipo, solo jugador en el de los jueves. */
export const ME_TWO_TEAMS: Me = {
  user: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70', name: 'Kevin López', email: 'k@example.com' },
  consent: { policyVersion: 'x', acceptedAt: '2026-10-21T10:00:00.000Z' },
  profile: DEFAULT_PROFILE,
  teams: [
    {
      team: { id: TEAM_A, name: 'Primer equipo', format: 'F11', formats: ['F11'], season: '2026' },
      club: CLUB,
      roles: ['coach', 'player'],
    },
    {
      team: { id: TEAM_B, name: 'Los del jueves', format: 'F8', formats: ['F8'], season: '2026' },
      club: CLUB,
      roles: ['player'],
    },
  ],
  clubs: [{ id: CLUB.id, name: CLUB.name, role: 'owner' }],
};
