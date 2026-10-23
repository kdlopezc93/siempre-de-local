import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateMatchRequest,
  Match,
  MatchReply,
  MatchResponse,
  UpdateMatchRequest,
} from '@sdl/contracts';
import { isMatchOpen, replySummary } from '@sdl/domain';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
import { can, type Actor, type TeamPermission } from '../../../shared/authz/policy.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import {
  PROFILES_QUERY,
  type ProfilesQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from '../../squad/application/ports/squad.ports.js';
import {
  TEAMS_REPOSITORY,
  type TeamRecord,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import {
  MATCHES_REPOSITORY,
  type MatchesRepository,
  type MatchRecord,
} from './ports/matches.repository.js';

/**
 * Partidos (Fase 7): el cuerpo técnico convoca, edita o cancela; cada jugador responde voy /
 * no voy hasta la hora del partido (D17); el equipo lo ve. El reloj se inyecta (`now`).
 */
@Injectable()
export class Matches {
  constructor(
    @Inject(MATCHES_REPOSITORY) private readonly matches: MatchesRepository,
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  async list(actor: Actor, teamId: string, now = new Date()): Promise<Match[]> {
    await this.authorize(actor, teamId, 'team.read');
    const [records, playerIds] = await Promise.all([
      this.matches.listByTeam(teamId),
      this.activePlayerIds(teamId),
    ]);
    const replies = await this.matches.replies(records.map((m) => m.id));
    return records.map((m) => this.toMatch(m, actor, playerIds, replies.get(m.id)!, now));
  }

  async get(
    actor: Actor,
    teamId: string,
    matchId: string,
    now = new Date(),
  ): Promise<MatchResponse> {
    const team = await this.authorize(actor, teamId, 'team.read');
    const record = await this.findOr404(teamId, matchId);
    const players = await this.players.activePlayers(teamId);
    const replies = (await this.matches.replies([matchId])).get(matchId)!;
    const match = this.toMatch(
      record,
      actor,
      players.map((p) => p.userId),
      replies,
      now,
    );
    // Quién respondió qué lo ve el cuerpo técnico (y el admin del club), no los compañeros.
    if (!can(actor, 'team.results.read', { teamId, clubId: team.club.id })) {
      return { match, roster: null };
    }
    const profiles = await this.profiles.profilesOf(
      players.map((p) => ({ id: p.userId, name: p.name })),
    );
    const roster = players
      .map((p) => ({
        playerId: p.userId,
        displayName: profiles.get(p.userId)?.displayName ?? p.name,
        jerseyNumber: p.jerseyNumber,
        reply: replies.get(p.userId) ?? null,
      }))
      .sort(
        (a, b) =>
          (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) ||
          a.displayName.localeCompare(b.displayName, 'es'),
      );
    return { match, roster };
  }

  async create(actor: Actor, teamId: string, request: CreateMatchRequest, now = new Date()) {
    const team = await this.authorize(actor, teamId, 'team.matches.write');
    const startsAt = new Date(request.startsAt);
    this.requirePlayedFormat(team, request.format);
    if (startsAt <= now) {
      throw new BusinessRuleError('El partido tiene que ser más adelante.', 'MATCH_IN_PAST');
    }
    const id = await this.matches.create(teamId, actor.userId, { ...request, startsAt });
    await this.record(actor, teamId, id, 'match.created', { startsAt: request.startsAt });
    // D16: también aparece en "lo que toca"; el aviso es un extra que no puede fallar esto.
    await this.notifier.notifyUsers(await this.activePlayerIds(teamId), {
      kind: 'match-called',
      opponent: request.opponent,
      startsAt: startsAt.toISOString(),
      url: `/equipos/${teamId}/partidos/${id}`,
    });
    return this.get(actor, teamId, id, now);
  }

  async update(
    actor: Actor,
    teamId: string,
    matchId: string,
    patch: UpdateMatchRequest,
    now = new Date(),
  ) {
    const team = await this.authorize(actor, teamId, 'team.matches.write');
    const record = await this.findOr404(teamId, matchId);
    this.requireOpen(record, now);
    if (patch.format) this.requirePlayedFormat(team, patch.format);
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : undefined;
    if (startsAt && startsAt <= now) {
      throw new BusinessRuleError('El partido tiene que ser más adelante.', 'MATCH_IN_PAST');
    }
    const changes = Object.fromEntries(
      Object.entries({ ...patch, startsAt }).filter(([, v]) => v !== undefined),
    );
    await this.matches.update(matchId, changes);
    await this.record(
      actor,
      teamId,
      matchId,
      patch.status === 'cancelled' ? 'match.cancelled' : 'match.updated',
      {
        fields: Object.keys(changes),
      },
    );
    return this.get(actor, teamId, matchId, now);
  }

  /** El jugador responde voy / no voy; puede cambiarla hasta la hora del partido. */
  async reply(actor: Actor, teamId: string, matchId: string, reply: MatchReply, now = new Date()) {
    await this.authorize(actor, teamId, 'team.read');
    if (!(actor.teams.get(teamId) ?? []).includes('player')) {
      throw new ForbiddenError('Solo los jugadores del equipo responden la convocatoria.');
    }
    const record = await this.findOr404(teamId, matchId);
    this.requireOpen(record, now);
    await this.matches.setReply(matchId, actor.userId, reply);
    return this.get(actor, teamId, matchId, now);
  }

  private toMatch(
    m: MatchRecord,
    actor: Actor,
    playerIds: string[],
    replies: Map<string, MatchReply>,
    now: Date,
  ): Match {
    const summary = replySummary(playerIds, replies);
    return {
      id: m.id,
      format: m.format,
      startsAt: m.startsAt.toISOString(),
      place: m.place,
      opponent: m.opponent,
      status: m.status,
      open: isMatchOpen(m, now),
      createdBy: m.createdBy,
      replies: { yes: summary.yes.length, no: summary.no.length, pending: summary.pending.length },
      myReply: replies.get(actor.userId) ?? null,
      published:
        m.lineupId && m.publishedAt
          ? { lineupId: m.lineupId, at: m.publishedAt.toISOString() }
          : null,
    };
  }

  private async activePlayerIds(teamId: string) {
    return (await this.players.activePlayers(teamId)).map((p) => p.userId);
  }

  private async authorize(
    actor: Actor,
    teamId: string,
    permission: TeamPermission,
  ): Promise<TeamRecord> {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, permission, { teamId, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    return team;
  }

  private async findOr404(teamId: string, matchId: string) {
    const record = await this.matches.find(teamId, matchId);
    if (!record) throw new NotFoundError('Partido no encontrado', 'MATCH_NOT_FOUND');
    return record;
  }

  private requireOpen(record: MatchRecord, now: Date) {
    if (!isMatchOpen(record, now)) {
      throw new ConflictError(
        record.status === 'cancelled' ? 'El partido fue cancelado.' : 'El partido ya empezó.',
        'MATCH_CLOSED',
      );
    }
  }

  private requirePlayedFormat(team: TeamRecord, format: CreateMatchRequest['format']) {
    if (!team.formats.includes(format)) {
      throw new BusinessRuleError(
        'El equipo no juega ese formato (cámbialo en Datos del equipo).',
        'FORMAT_NOT_PLAYED',
      );
    }
  }

  private record(
    actor: Actor,
    teamId: string,
    matchId: string,
    action: string,
    meta: Record<string, unknown>,
  ) {
    return this.audit.record({
      actorUserId: actor.userId,
      action,
      entity: 'team_match',
      entityId: matchId,
      teamId,
      meta,
    });
  }
}
