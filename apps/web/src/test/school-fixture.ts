import type { ClubResponse } from '@sdl/contracts';

import type { Me } from '../shared/api/auth';
import { ME_TWO_TEAMS, TEAM_A, TEAM_B } from './me-two-teams';

/** Escuela Semillas (2026-11-07): Kevin es dueño y profe de Sub-12 masculino A. */
export const SCHOOL = ME_TWO_TEAMS.clubs[0]!.id;
export const ME_SCHOOL: Me = {
  ...ME_TWO_TEAMS,
  teams: ME_TWO_TEAMS.teams.map((t) => ({
    ...t,
    club: { id: SCHOOL, name: 'Escuela Semillas', kind: 'school' as const },
  })),
  clubs: [{ id: SCHOOL, name: 'Escuela Semillas', role: 'owner', kind: 'school' }],
};

export const VENUE = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fa1';
const group = (
  id: string,
  name: string,
  category: string,
  years: { from: number | null; to: number },
  gender: 'male' | 'female' | 'mixed',
  extra: Partial<ClubResponse['teams'][number]> = {},
): ClubResponse['teams'][number] => ({
  id,
  name,
  category,
  format: 'F8',
  season: '2026',
  archived: false,
  birthYears: years,
  gender,
  venue: null,
  members: 10,
  ...extra,
});

export const schoolClub = (extra: Partial<ClubResponse> = {}): ClubResponse => ({
  club: {
    id: SCHOOL,
    name: 'Escuela Semillas',
    city: 'Kennedy',
    kind: 'school',
    sport: 'football',
  },
  myRole: 'owner',
  teamsLimit: 30,
  teams: [
    group(TEAM_A, 'Sub-12 masculino A', 'Sub-12', { from: 2014, to: 2015 }, 'male', {
      venue: { id: VENUE, name: 'El Tunal' },
      members: 18,
    }),
    group(TEAM_B, 'Sub-12 femenino', 'Sub-12', { from: 2014, to: 2015 }, 'female'),
    group(
      '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fa2',
      'Mayores',
      'Mayores',
      { from: null, to: 2008 },
      'male',
    ),
  ],
  admins: [{ userId: ME_TWO_TEAMS.user.id, name: 'Kevin López', role: 'owner' }],
  candidates: [],
  venues: [{ id: VENUE, name: 'El Tunal', address: 'Cancha 3', teams: 1 }],
  ...extra,
});
