import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateMatchRequest,
  Match,
  MatchAttendanceRequest,
  MatchRatingRequest,
  MatchRatingsResponse,
  MatchRatingValue,
  MatchReply,
  MatchResponse,
  MatchResultRequest,
  PlayerMatchRatingsResponse,
  Profile,
  Tournament,
  UpdateMatchRequest,
  TeamScorersResponse,
} from '@sdl/contracts';
import {
  hasMatchStarted,
  goalsProblem,
  isMinorsGroup,
  tallyEvents,
  isGame,
  isMatchEditable,
  isMatchOpen,
  matchKindProblem,
  replySummary,
  whoCame,
  dueReminder,
  manualReminderBlockedUntil,
  upcomingReminders,
} from '@sdl/domain';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
import {
  can,
  cannotRateMessage,
  ratableBy,
  type Actor,
  type TeamPermission,
} from '../../../shared/authz/policy.js';
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
  type MatchData,
  type MatchesRepository,
  type MatchRecord,
  type TournamentRecord,
} from './ports/matches.repository.js';

const toTournament = (t: TournamentRecord): Tournament => ({
  id: t.id,
  name: t.name,
  createdAt: t.createdAt.toISOString(),
});

const toEditable = (m: MatchRecord) => ({ status: m.status, hasResult: m.resultAt !== null });

type TeamPlayer = Awaited<ReturnType<TeamPlayersQuery['activePlayers']>>[number];

const byJerseyThenName = (
  a: { jerseyNumber: number | null; displayName: string },
  b: { jerseyNumber: number | null; displayName: string },
) =>
  (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) ||
  a.displayName.localeCompare(b.displayName, 'es');

/** El aviso de la convocatoria: el rival en los partidos; en el entreno, que es entreno. */
function calledMessage(data: Pick<MatchData, 'kind' | 'opponent' | 'startsAt'>, url: string) {
  return isGame(data.kind)
    ? {
        kind: 'match-called' as const,
        opponent: data.opponent ?? '',
        startsAt: data.startsAt.toISOString(),
        url,
      }
    : {
        kind: 'training-called' as const,
        // El service worker viejo no conoce este aviso: muestra "Novedades del partido: Entrenamiento".
        opponent: 'Entrenamiento',
        startsAt: data.startsAt.toISOString(),
        url,
      };
}

const reminderState = (m: MatchRecord) => ({
  startsAt: m.startsAt,
  createdAt: m.createdAt,
  eveSentAt: m.reminderEveAt,
  soonSentAt: m.reminderSoonAt,
});

/** El aviso del recordatorio: como la convocatoria, se responde desde ahí. */
function reminderMessage(m: MatchRecord, stage: 'eve' | 'soon' | 'manual') {
  const game = isGame(m.kind);
  return {
    kind: game ? ('match-reminder' as const) : ('training-reminder' as const),
    opponent: game ? (m.opponent ?? '') : 'Entrenamiento',
    startsAt: m.startsAt.toISOString(),
    url: `/equipos/${m.teamId}/partidos/${m.id}`,
    stage,
  };
}

/**
 * Partidos (Fase 7): el cuerpo técnico convoca, edita o cancela (hasta cargar el resultado);
 * cada jugador responde voy / no voy hasta la hora del partido (D17); el equipo lo ve. Después del partido, el resultado y
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

  /**
   * Goleadores, asistencias y tarjetas de los partidos del equipo (2026-11-06): lo ve todo el
   * equipo. Solo quien tiene algo, de más goles a menos (y después asistencias).
   */
  async scorers(actor: Actor, teamId: string, now = new Date()): Promise<TeamScorersResponse> {
    const team = await this.authorize(actor, teamId, 'team.read');
    // Con niños no hay tabla (2026-11-10): ni siquiera se calcula.
    if (
      isMinorsGroup({ clubKind: team.club.kind, birthYears: team.birthYears }, now.getFullYear())
    ) {
      return { players: [], forMinors: true };
    }
    const [records, players] = await Promise.all([
      this.matches.listByTeam(teamId),
      this.players.activePlayers(teamId),
    ]);
    const events = await this.matches.events(
      records.filter((m) => m.status !== 'cancelled').map((m) => m.id),
    );
    const all = [...events.values()];
    const names = new Map(
      all
        .flatMap((e) => [
          ...e.goals.flatMap((g) => [g.scorer, g.assist].filter((p) => p !== null)),
          ...e.cards.map((c) => c.player),
        ])
        .map((p) => [p.id, p]),
    );
    const tally = tallyEvents(
      all.flatMap((e) =>
        e.goals.map((g) => ({
          scorerId: g.scorer?.id ?? null,
          assistId: g.assist?.id ?? null,
          ownGoal: g.ownGoal,
        })),
      ),
      all.flatMap((e) => e.cards.map((c) => ({ playerId: c.player.id, color: c.color }))),
    );
    const profiles = await this.profilesOf([...names.values()]);
    const jersey = new Map(players.map((p) => [p.userId, p.jerseyNumber]));
    return {
      forMinors: false,
      players: [...tally]
        .map(([id, counts]) => ({
          player: {
            id,
            displayName: profiles.get(id)?.displayName ?? names.get(id)!.name,
            jerseyNumber: jersey.get(id) ?? null,
          },
          ...counts,
        }))
        .sort(
          (a, b) =>
            b.goals - a.goals ||
            b.assists - a.assists ||
            a.player.displayName.localeCompare(b.player.displayName, 'es'),
        ),
    };
  }

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
    // Quién respondió qué lo ve el cuerpo técnico (y el admin del club), no los compañeros; el
    // tesorero también, porque pasa lista (2026-10-30).
    const scope = { teamId, clubId: team.club.id };
    if (!can(actor, 'team.results.read', scope) && !can(actor, 'team.attendance.write', scope)) {
      return { match: match!, roster: null };
    }
    const [allReplies, attendance, profiles, staff] = await Promise.all([
      this.matches.replies([matchId]),
      this.matches.attendance(matchId),
      this.profiles.profilesOf(players.map((p) => ({ id: p.userId, name: p.name }))),
      this.players.activeStaff(teamId),
    ]);
    const replies = allReplies.get(matchId)!;
    const came = whoCame(replies, record.attendanceTakenAt ? attendance : null);
    const ratable = ratableBy(actor, teamId, staff);
    const roster = players
      .map((p) => ({
        playerId: p.userId,
        displayName: profiles.get(p.userId)?.displayName ?? p.name,
        jerseyNumber: p.jerseyNumber,
        reply: replies.get(p.userId) ?? null,
        canRate: ratable(p.userId),
        injured: p.injuredAt !== null,
        came: came.has(p.userId),
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
    const data: MatchData = {
      kind: request.kind,
      format: request.format,
      startsAt,
      place: request.place,
      opponent: request.opponent ?? null,
      tournamentId: request.tournamentId ?? null,
    };
    await this.requireKindFields(teamId, data);
    const id = await this.matches.create(teamId, actor.userId, data);
    await this.record(actor, teamId, id, 'match.created', {
      startsAt: request.startsAt,
      kind: request.kind,
    });
    // D16: también aparece en "lo que toca"; el aviso es un extra que no puede fallar esto.
    await this.notifier.notifyUsers(
      await this.activePlayerIds(teamId),
      calledMessage(data, `/equipos/${teamId}/partidos/${id}`),
    );
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
    // Asignarle el torneo a uno de campeonato se puede siempre, aunque ya tenga resultado: los de
    // antes del 2026-10-28 quedaron sin torneo (Kevin). Lo demás, solo mientras sea editable.
    const onlyTournament =
      Object.keys(patch).length === 1 && patch.tournamentId && record.kind === 'championship';
    if (!onlyTournament) this.requireEditable(record);
    if (patch.format) this.requirePlayedFormat(team, patch.format);
    if ('kind' in patch || 'opponent' in patch || 'tournamentId' in patch) {
      const kind = patch.kind ?? record.kind;
      await this.requireKindFields(teamId, {
        kind,
        opponent: patch.opponent !== undefined ? patch.opponent : record.opponent,
        tournamentId:
          patch.tournamentId !== undefined ? patch.tournamentId : (record.tournament?.id ?? null),
      });
    }
    const startsAt = patch.startsAt ? new Date(patch.startsAt) : undefined;
    // Uno por jugar no se pasa al pasado; uno que ya pasó sí se corrige a otra hora pasada.
    if (startsAt && startsAt <= now && isMatchOpen(record, now)) {
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
    this.requireGame(record);
    this.requireStarted(record, now);
    if (request.figurePlayerId) await this.requirePlayer(teamId, request.figurePlayerId);
    // Goles y tarjetas (2026-11-06): de jugadores del equipo, a lo sumo los goles del marcador.
    const problem = request.goals ? goalsProblem(request.goalsFor, request.goals) : null;
    if (problem) throw new BusinessRuleError(problem, 'MATCH_GOALS');
    const involved = new Set([
      ...(request.goals ?? []).flatMap((g) => [g.scorerId, g.assistId]),
      ...(request.cards ?? []).map((c) => c.playerId),
    ]);
    involved.delete(null);
    if (involved.size > 0) await this.requirePlayers(teamId, [...involved] as string[]);
    const { goals, cards, ...result } = request;
    await this.matches.setResult(matchId, {
      ...result,
      resultAt: now,
      ...(goals ? { goals } : {}),
      ...(cards ? { cards } : {}),
    });
    await this.record(actor, teamId, matchId, 'match.result_recorded', {
      goalsFor: request.goalsFor,
      goalsAgainst: request.goalsAgainst,
      figure: request.figurePlayerId !== null,
      goals: request.goals?.length ?? null,
      cards: request.cards?.length ?? null,
    });
    // La felicitación a la figura, una vez: corregir el marcador no la repite.
    if (request.figurePlayerId && request.figurePlayerId !== record.figure?.id) {
      await this.notifier.notifyUsers([request.figurePlayerId], {
        kind: 'match-figure',
        opponent: record.opponent ?? '',
        startsAt: record.startsAt.toISOString(),
        url: `/equipos/${teamId}/partidos/${matchId}`,
      });
    }
    return this.get(actor, teamId, matchId, now);
  }

  /**
   * "¿Quién vino?" (2026-10-30): el cuerpo técnico pasa lista desde la hora del partido, también
   * en los entrenos. La lista reemplaza la anterior y se corrige sin plazo.
   */
  async takeAttendance(
    actor: Actor,
    teamId: string,
    matchId: string,
    request: MatchAttendanceRequest,
    now = new Date(),
  ): Promise<MatchResponse> {
    await this.authorize(actor, teamId, 'team.attendance.write');
    const record = await this.findOr404(teamId, matchId);
    if (!hasMatchStarted(record, now)) {
      throw new ConflictError(
        record.status === 'cancelled'
          ? 'El partido fue cancelado.'
          : 'La lista se pasa desde la hora del partido.',
        'MATCH_NOT_STARTED',
      );
    }
    const playerIds = [...new Set(request.playerIds)];
    const active = new Set(await this.activePlayerIds(teamId));
    if (playerIds.some((id) => !active.has(id))) {
      throw new BusinessRuleError('No es jugador de este equipo.', 'PLAYER_NOT_IN_TEAM');
    }
    await this.matches.setAttendance(matchId, playerIds, actor.userId, now);
    await this.record(actor, teamId, matchId, 'match.attendance_taken', {
      came: playerIds.length,
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
    this.requireGame(record);
    this.requireStarted(record, now);
    await this.requirePlayer(teamId, playerId);
    await this.requireRatable(actor, teamId, playerId);
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
    await this.requireRatable(actor, teamId, playerId);
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

  /** Los torneos del equipo (2026-10-28): para elegir uno al convocar de campeonato. */
  async tournaments(actor: Actor, teamId: string): Promise<Tournament[]> {
    await this.authorize(actor, teamId, 'team.read');
    return (await this.matches.tournaments(teamId)).map(toTournament);
  }

  async createTournament(actor: Actor, teamId: string, name: string): Promise<Tournament> {
    await this.authorize(actor, teamId, 'team.matches.write');
    const created = await this.matches.createTournament(teamId, actor.userId, name);
    if (created === 'name-taken') {
      throw new ConflictError(
        'El equipo ya tiene un torneo con ese nombre.',
        'TOURNAMENT_NAME_TAKEN',
      );
    }
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'tournament.created',
      entity: 'tournament',
      entityId: created.id,
      teamId,
      meta: {},
    });
    return toTournament(created);
  }

  /**
   * "Recordarles ahora" (2026-11-06): el cuerpo técnico les recuerda a los que no han respondido,
   * una vez cada 2 horas, mientras se puede responder.
   */
  async remind(
    actor: Actor,
    teamId: string,
    matchId: string,
    now = new Date(),
  ): Promise<{ reminded: number }> {
    await this.authorize(actor, teamId, 'team.matches.write');
    const record = await this.findOr404(teamId, matchId);
    this.requireOpen(record, now);
    if (manualReminderBlockedUntil(record.reminderManualAt, now)) {
      throw new ConflictError(
        'Ya les recordaste hace poco. Puedes volver a hacerlo 2 horas después.',
        'REMINDER_TOO_SOON',
      );
    }
    const pending = await this.pendingPlayerIds(record);
    await this.notifier.notifyUsers(pending, reminderMessage(record, 'manual'));
    await this.matches.markReminder(record.id, 'reminderManualAt', now);
    await this.record(actor, teamId, record.id, 'match.reminded', { people: pending.length });
    return { reminded: pending.length };
  }

  /**
   * La tarea programada del recordatorio (cada media hora, 2026-11-06): a los que no han
   * respondido, la noche antes y 3 horas antes, en los equipos que lo tienen prendido.
   */
  async remindDue(now = new Date()): Promise<{ matches: number; reminded: number }> {
    const soon = await this.matches.scheduledBetween(now, new Date(now.getTime() + 2 * 86_400_000));
    const teams = new Map<string, boolean>();
    let matches = 0;
    let reminded = 0;
    for (const m of soon) {
      const stage = dueReminder(reminderState(m), now);
      if (!stage) continue;
      if (!teams.has(m.teamId)) {
        teams.set(m.teamId, (await this.teams.findById(m.teamId))?.callUpReminders ?? false);
      }
      // Apagado en el equipo: se marca igual, para que no salga tarde si lo prenden.
      if (teams.get(m.teamId)) {
        const pending = await this.pendingPlayerIds(m);
        await this.notifier.notifyUsers(pending, reminderMessage(m, stage));
        reminded += pending.length;
        matches += 1;
      }
      await this.matches.markReminder(
        m.id,
        stage === 'eve' ? 'reminderEveAt' : 'reminderSoonAt',
        now,
      );
    }
    return { matches, reminded };
  }

  /** Lo que el cuerpo técnico ve del recordatorio en un partido que todavía se responde. */
  private remindersOf(m: MatchRecord, team: TeamRecord, now: Date) {
    const blocked = manualReminderBlockedUntil(m.reminderManualAt, now);
    return {
      enabled: team.callUpReminders,
      upcoming: team.callUpReminders
        ? upcomingReminders(reminderState(m), now).map((d) => d.toISOString())
        : [],
      lastManualAt: m.reminderManualAt?.toISOString() ?? null,
      blockedUntil: blocked?.toISOString() ?? null,
    };
  }

  /** Los jugadores activos que no han respondido y no están lesionados. */
  private async pendingPlayerIds(m: MatchRecord) {
    const [players, replies] = await Promise.all([
      this.players.activePlayers(m.teamId),
      this.matches.replies([m.id]),
    ]);
    const answered = replies.get(m.id) ?? new Map();
    return players
      .filter((p) => p.injuredAt === null && !answered.has(p.userId))
      .map((p) => p.userId);
  }

  private async toMatches(
    records: MatchRecord[],
    actor: Actor,
    team: TeamRecord,
    players: TeamPlayer[],
    now: Date,
  ): Promise<Match[]> {
    const ids = records.map((m) => m.id);
    const [replies, myRatings, events] = await Promise.all([
      this.matches.replies(ids),
      this.myRatings(actor, team, ids),
      this.matches.events(ids),
    ]);
    const profiles = await this.profilesOf([
      ...records.flatMap((m) => (m.figure ? [m.figure] : [])),
      ...[...events.values()].flatMap((e) => [
        ...e.goals.flatMap((g) => [g.scorer, g.assist].filter((p) => p !== null)),
        ...e.cards.map((c) => c.player),
      ]),
    ]);
    const playerIds = players.map((p) => p.userId);
    // El recordatorio de la convocatoria (2026-11-06) lo ve y lo toca el cuerpo técnico.
    const staff = can(actor, 'team.matches.write', { teamId: team.id, clubId: team.club.id });
    const injured = new Set(players.filter((p) => p.injuredAt !== null).map((p) => p.userId));
    const jersey = new Map(players.map((p) => [p.userId, p.jerseyNumber]));
    const person = (p: { id: string; name: string }) => ({
      id: p.id,
      displayName: profiles.get(p.id)?.displayName ?? p.name,
      jerseyNumber: jersey.get(p.id) ?? null,
    });
    return records.map((m) => {
      const matchReplies = replies.get(m.id)!;
      const summary = replySummary(playerIds, matchReplies, injured);
      return {
        id: m.id,
        kind: m.kind,
        format: m.format,
        startsAt: m.startsAt.toISOString(),
        place: m.place,
        opponent: m.opponent,
        tournament: m.tournament,
        status: m.status,
        open: isMatchOpen(m, now),
        editable: isMatchEditable(toEditable(m)),
        createdBy: m.createdBy,
        replies: {
          yes: summary.yes.length,
          no: summary.no.length,
          pending: summary.pending.length,
          injured: summary.injured.length,
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
                figure: m.figure ? person(m.figure) : null,
                goals: events.get(m.id)!.goals.map((g) => ({
                  scorer: g.scorer ? person(g.scorer) : null,
                  assist: g.assist ? person(g.assist) : null,
                  ownGoal: g.ownGoal,
                })),
                cards: events.get(m.id)!.cards.map((c) => ({
                  player: person(c.player),
                  color: c.color,
                })),
                at: m.resultAt.toISOString(),
              }
            : null,
        myRating: myRatings.get(m.id) ?? null,
        attendanceTaken: m.attendanceTakenAt !== null,
        reminders: staff && isMatchOpen(m, now) ? this.remindersOf(m, team, now) : null,
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
    await this.requirePlayers(teamId, [playerId]);
  }

  private async requirePlayers(teamId: string, playerIds: string[]) {
    const active = new Set((await this.players.activePlayers(teamId)).map((p) => p.userId));
    if (playerIds.some((id) => !active.has(id))) {
      throw new BusinessRuleError('No es jugador de este equipo.', 'PLAYER_NOT_IN_TEAM');
    }
  }

  /** Quién valora a quién (04 §2.2): con sus roles de hoy en el equipo. */
  private async requireRatable(actor: Actor, teamId: string, playerId: string) {
    const staff = await this.players.activeStaff(teamId);
    if (!ratableBy(actor, teamId, staff)(playerId)) {
      throw new ForbiddenError(cannotRateMessage(actor, playerId), 'CANNOT_RATE_PLAYER');
    }
  }

  /** Rival y torneo según el tipo (dominio), y que el torneo sea de este equipo. */
  private async requireKindFields(
    teamId: string,
    data: Pick<MatchData, 'kind' | 'opponent' | 'tournamentId'>,
  ) {
    const problem = matchKindProblem(data);
    if (problem) throw new BusinessRuleError(problem, 'MATCH_KIND_FIELDS');
    if (data.tournamentId && !(await this.matches.findTournament(teamId, data.tournamentId))) {
      throw new BusinessRuleError('Ese torneo no es del equipo.', 'TOURNAMENT_NOT_FOUND');
    }
  }

  /** Un entrenamiento es convocatoria y asistencia: sin resultado ni evaluaciones. */
  private requireGame(record: MatchRecord) {
    if (!isGame(record.kind)) {
      throw new BusinessRuleError(
        'Un entrenamiento no tiene resultado ni evaluaciones.',
        'MATCH_IS_TRAINING',
      );
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

  private requireEditable(record: MatchRecord) {
    if (!isMatchEditable(toEditable(record))) {
      throw new ConflictError(
        record.status === 'cancelled'
          ? 'El partido fue cancelado.'
          : 'El partido ya tiene resultado: corrige el resultado, no el partido.',
        'MATCH_CLOSED',
      );
    }
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
