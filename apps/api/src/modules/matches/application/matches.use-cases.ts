import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateMatchRequest,
  Match,
  MatchRatingRequest,
  MatchRatingsResponse,
  MatchRatingValue,
  MatchReply,
  MatchResponse,
  MatchResultRequest,
  PlayerMatchRatingsResponse,
  Profile,
  UpdateMatchRequest,
} from '@sdl/contracts';
import { hasMatchStarted, isMatchOpen, replySummary } from '@sdl/domain';

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

type TeamPlayer = Awaited<ReturnType<TeamPlayersQuery['activePlayers']>>[number];

const byJerseyThenName = (
  a: { jerseyNumber: number | null; displayName: string },
  b: { jerseyNumber: number | null; displayName: string },
) =>
  (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) ||
  a.displayName.localeCompare(b.displayName, 'es');

/**
 * Partidos (Fase 7): el cuerpo técnico convoca, edita o cancela; cada jugador responde voy /
 * no voy hasta la hora del partido (D17); el equipo lo ve. Después del partido, el resultado y
 * las evaluaciones (D18). El reloj se inyecta (`now`).
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
    const team = await this.authorize(actor, teamId, 'team.read');
    const [records, players] = await Promise.all([
      this.matches.listByTeam(teamId),
      this.players.activePlayers(teamId),
    ]);
    return this.toMatches(records, actor, team, players, now);
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
    const [match] = await this.toMatches([record], actor, team, players, now);
    // Quién respondió qué lo ve el cuerpo técnico (y el admin del club), no los compañeros.
    if (!can(actor, 'team.results.read', { teamId, clubId: team.club.id })) {
      return { match: match!, roster: null };
    }
    const replies = (await this.matches.replies([matchId])).get(matchId)!;
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
      .sort(byJerseyThenName);
    return { match: match!, roster };
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

  /** Después del partido (D18): el resultado lo carga el cuerpo técnico desde la hora. */
  async recordResult(
    actor: Actor,
    teamId: string,
    matchId: string,
    request: MatchResultRequest,
    now = new Date(),
  ): Promise<MatchResponse> {
    await this.authorize(actor, teamId, 'team.matches.write');
    const record = await this.findOr404(teamId, matchId);
    this.requireStarted(record, now);
    if (request.figurePlayerId) await this.requirePlayer(teamId, request.figurePlayerId);
    await this.matches.setResult(matchId, { ...request, resultAt: now });
    await this.record(actor, teamId, matchId, 'match.result_recorded', {
      goalsFor: request.goalsFor,
      goalsAgainst: request.goalsAgainst,
      figure: request.figurePlayerId !== null,
    });
    return this.get(actor, teamId, matchId, now);
  }

  /** Las evaluaciones del partido, con nota y autor: cuerpo técnico y admin del club. */
  async ratings(actor: Actor, teamId: string, matchId: string): Promise<MatchRatingsResponse> {
    await this.authorize(actor, teamId, 'team.results.read');
    await this.findOr404(teamId, matchId);
    const [rows, players] = await Promise.all([
      this.matches.ratings(matchId),
      this.players.activePlayers(teamId),
    ]);
    const jersey = new Map(players.map((p) => [p.userId, p.jerseyNumber]));
    const profiles = await this.profilesOf(
      rows.map((r) => ({ id: r.playerId, name: r.playerName })),
    );
    const items = rows
      .map((r) => ({
        playerId: r.playerId,
        displayName: profiles.get(r.playerId)?.displayName ?? r.playerName,
        jerseyNumber: jersey.get(r.playerId) ?? null,
        rating: r.rating,
        note: r.note,
        ratedBy: r.ratedBy,
        ratedAt: r.ratedAt.toISOString(),
      }))
      .sort(byJerseyThenName);
    return { items };
  }

  /** Evaluar (o corregir) a un jugador del equipo en el partido: 1 Flojo a 5 Figura. */
  async rate(
    actor: Actor,
    teamId: string,
    matchId: string,
    playerId: string,
    request: MatchRatingRequest,
    now = new Date(),
  ): Promise<MatchRatingsResponse> {
    await this.authorize(actor, teamId, 'team.ratings.write');
    const record = await this.findOr404(teamId, matchId);
    this.requireStarted(record, now);
    await this.requirePlayer(teamId, playerId);
    await this.matches.setRating(matchId, playerId, {
      rating: request.rating as MatchRatingValue,
      note: request.note ?? null,
      ratedBy: actor.userId,
    });
    await this.record(actor, teamId, matchId, 'match.player_rated', { playerId });
    return this.ratings(actor, teamId, matchId);
  }

  /** Quitar la evaluación (p. ej., al final no jugó). */
  async unrate(
    actor: Actor,
    teamId: string,
    matchId: string,
    playerId: string,
  ): Promise<MatchRatingsResponse> {
    await this.authorize(actor, teamId, 'team.ratings.write');
    await this.findOr404(teamId, matchId);
    await this.matches.deleteRating(matchId, playerId);
    await this.record(actor, teamId, matchId, 'match.player_unrated', { playerId });
    return this.ratings(actor, teamId, matchId);
  }

  /** Cómo le fue a un jugador partido a partido, con notas: cuerpo técnico y admin del club. */
  async playerRatings(
    actor: Actor,
    teamId: string,
    playerId: string,
  ): Promise<PlayerMatchRatingsResponse> {
    await this.authorize(actor, teamId, 'team.results.read');
    const rows = await this.matches.playerRatings(teamId, playerId);
    return { items: rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString() })) };
  }

  private async toMatches(
    records: MatchRecord[],
    actor: Actor,
    team: TeamRecord,
    players: TeamPlayer[],
    now: Date,
  ): Promise<Match[]> {
    const ids = records.map((m) => m.id);
    const [replies, myRatings, profiles] = await Promise.all([
      this.matches.replies(ids),
      this.myRatings(actor, team, ids),
      this.profilesOf(records.flatMap((m) => (m.figure ? [m.figure] : []))),
    ]);
    const playerIds = players.map((p) => p.userId);
    const jersey = new Map(players.map((p) => [p.userId, p.jerseyNumber]));
    return records.map((m) => {
      const matchReplies = replies.get(m.id)!;
      const summary = replySummary(playerIds, matchReplies);
      return {
        id: m.id,
        format: m.format,
        startsAt: m.startsAt.toISOString(),
        place: m.place,
        opponent: m.opponent,
        status: m.status,
        open: isMatchOpen(m, now),
        createdBy: m.createdBy,
        replies: {
          yes: summary.yes.length,
          no: summary.no.length,
          pending: summary.pending.length,
        },
        myReply: matchReplies.get(actor.userId) ?? null,
        published:
          m.lineupId && m.publishedAt
            ? { lineupId: m.lineupId, at: m.publishedAt.toISOString() }
            : null,
        result:
          m.goalsFor !== null && m.goalsAgainst !== null && m.resultAt
            ? {
                goalsFor: m.goalsFor,
                goalsAgainst: m.goalsAgainst,
                figure: m.figure
                  ? {
                      id: m.figure.id,
                      displayName: profiles.get(m.figure.id)?.displayName ?? m.figure.name,
                      jerseyNumber: jersey.get(m.figure.id) ?? null,
                    }
                  : null,
                at: m.resultAt.toISOString(),
              }
            : null,
        myRating: myRatings.get(m.id) ?? null,
      };
    });
  }

  /** Su evaluación de cada partido, solo si es jugador y el equipo las muestra (D18). */
  private async myRatings(actor: Actor, team: TeamRecord, matchIds: string[]) {
    const isPlayer = (actor.teams.get(team.id) ?? []).includes('player');
    if (!isPlayer || !team.matchRatingsVisibleToPlayers) return new Map<string, MatchRatingValue>();
    return this.matches.ratingsOf(matchIds, actor.userId);
  }

  private async profilesOf(users: { id: string; name: string }[]) {
    return users.length > 0 ? this.profiles.profilesOf(users) : new Map<string, Profile>();
  }

  private async requirePlayer(teamId: string, playerId: string) {
    const players = await this.players.activePlayers(teamId);
    if (!players.some((p) => p.userId === playerId)) {
      throw new BusinessRuleError('No es jugador de este equipo.', 'PLAYER_NOT_IN_TEAM');
    }
  }

  private requireStarted(record: MatchRecord, now: Date) {
    if (!hasMatchStarted(record, now)) {
      throw new ConflictError(
        record.status === 'cancelled'
          ? 'El partido fue cancelado.'
          : 'El resultado y las evaluaciones se cargan desde la hora del partido.',
        'MATCH_NOT_STARTED',
      );
    }
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
