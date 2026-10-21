import { describe, expect, it } from 'vitest';

import { can, type Actor, type ClubRole, type TeamPermission, type TeamRole } from './policy.js';

const SCOPE = { teamId: 'team-1', clubId: 'club-1' };

function actor({
  teamRoles = [],
  clubRole,
  otherTeam = false,
}: { teamRoles?: TeamRole[]; clubRole?: ClubRole; otherTeam?: boolean } = {}): Actor {
  return {
    userId: 'u',
    platformAdmin: false,
    clubs: new Map(clubRole ? [[otherTeam ? 'club-2' : 'club-1', clubRole]] : []),
    teams: new Map(teamRoles.length ? [[otherTeam ? 'team-2' : 'team-1', teamRoles]] : []),
  };
}

/** Matriz de 04 §2.2 para las acciones de equipo: player, assistant, coach, club admin. */
const MATRIX: [TeamPermission, boolean, boolean, boolean, boolean][] = [
  ['team.read', true, true, true, true],
  ['team.results.read', false, true, true, true],
  ['team.ratings.write', false, true, true, false],
  ['team.assessments.write', false, true, true, false],
  ['team.lineups.write', false, true, true, false],
  ['team.attempts.void', false, false, true, true],
  ['team.reevaluations.request', false, false, true, true],
  ['team.players.invite', false, false, true, true],
  ['team.staff.invite', false, false, false, true],
  ['team.members.manage', false, false, true, true],
  ['team.data.transfer', false, false, true, true],
];

describe('can — matriz de permisos (04 §2.2)', () => {
  it.each(MATRIX)('%s', (permission, player, assistant, coach, clubAdmin) => {
    expect(can(actor({ teamRoles: ['player'] }), permission, SCOPE)).toBe(player);
    expect(can(actor({ teamRoles: ['assistant'] }), permission, SCOPE)).toBe(assistant);
    expect(can(actor({ teamRoles: ['coach'] }), permission, SCOPE)).toBe(coach);
    expect(can(actor({ clubRole: 'owner' }), permission, SCOPE)).toBe(clubAdmin);
    expect(can(actor({ clubRole: 'admin' }), permission, SCOPE)).toBe(clubAdmin);
  });

  it('los roles de otro equipo o de otro club no dan nada', () => {
    for (const [permission] of MATRIX) {
      expect(can(actor({ teamRoles: ['coach'], otherTeam: true }), permission, SCOPE)).toBe(false);
      expect(can(actor({ clubRole: 'owner', otherTeam: true }), permission, SCOPE)).toBe(false);
    }
  });

  it('con varios roles en el equipo vale el que más permite', () => {
    expect(can(actor({ teamRoles: ['player', 'assistant'] }), 'team.ratings.write', SCOPE)).toBe(
      true,
    );
  });

  it('el admin de plataforma no tiene acceso implícito (soporte llega con audit_log)', () => {
    expect(can({ ...actor(), platformAdmin: true }, 'team.read', SCOPE)).toBe(false);
  });
});
