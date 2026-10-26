import { describe, expect, it } from 'vitest';

import {
  can,
  canRate,
  type Actor,
  type ClubRole,
  type TeamPermission,
  type TeamRole,
} from './policy.js';

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
  ['team.quiz.take', true, false, false, false],
  ['team.results.read', false, true, true, true],
  ['team.ratings.write', false, true, true, false],
  ['team.assessments.write', false, true, true, false],
  ['team.lineups.write', false, true, true, false],
  ['team.injuries.write', false, true, true, false],
  ['team.reminders.send', false, true, true, false],
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

describe('canRate — quién valora a quién (04 §2.2)', () => {
  const as = (userId: string, roles: TeamRole[]): Actor => ({
    userId,
    platformAdmin: false,
    clubs: new Map(),
    teams: new Map([['team-1', roles]]),
  });
  const coach = as('coach', ['coach', 'player']);
  const assistant = as('asis', ['assistant', 'player']);
  const player = { userId: 'jug', roles: ['player'] as TeamRole[] };
  const otherAssistant = { userId: 'asis-2', roles: ['assistant', 'player'] as TeamRole[] };
  const otherCoach = { userId: 'coach-2', roles: ['coach', 'player'] as TeamRole[] };

  it('el entrenador valora a todos los demás, pero no a sí mismo', () => {
    expect(canRate(coach, 'team-1', player)).toBe(true);
    expect(canRate(coach, 'team-1', otherAssistant)).toBe(true);
    expect(canRate(coach, 'team-1', otherCoach)).toBe(true);
    expect(canRate(coach, 'team-1', { userId: 'coach', roles: ['coach', 'player'] })).toBe(false);
  });

  it('el asistente valora a jugadores y al entrenador que juega, no a otros asistentes', () => {
    expect(canRate(assistant, 'team-1', player)).toBe(true);
    expect(canRate(assistant, 'team-1', otherCoach)).toBe(true);
    expect(canRate(assistant, 'team-1', otherAssistant)).toBe(false);
    expect(canRate(assistant, 'team-1', { userId: 'asis', roles: ['assistant', 'player'] })).toBe(
      false,
    );
  });

  it('un jugador o alguien de otro equipo no valora', () => {
    expect(canRate(as('x', ['player']), 'team-1', player)).toBe(false);
    expect(canRate(coach, 'team-2', player)).toBe(false);
  });
});
