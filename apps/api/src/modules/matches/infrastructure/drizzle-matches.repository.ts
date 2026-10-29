import { Inject, Injectable } from '@nestjs/common';
import type { MatchRatingValue, MatchReply } from '@sdl/contracts';
import { and, asc, desc, eq, gt, inArray, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseError } from 'pg';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { user } from '../../identity/infrastructure/schema.js';
import type { OpenMatchesQuery } from '../../teams/application/ports/open-matches.query.js';
import type {
  MatchData,
  MatchesRepository,
  MatchRecord,
  MatchResultData,
} from '../application/ports/matches.repository.js';
import { matchRating, matchReply, teamMatch, tournament } from './schema.js';

const UNIQUE_VIOLATION = '23505';

/** Drizzle envuelve el error de Postgres en `cause`. */
function isUniqueViolation(error: unknown): boolean {
  const cause =
    error instanceof Error && error.cause instanceof DatabaseError ? error.cause : error;
  return cause instanceof DatabaseError && cause.code === UNIQUE_VIOLATION;
}

const figure = alias(user, 'figure');
const rater = alias(user, 'rater');
const player = alias(user, 'player');

@Injectable()
export class DrizzleMatchesRepository implements MatchesRepository, OpenMatchesQuery {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  private select() {
    return this.connection.db
      .select({
        id: teamMatch.id,
        teamId: teamMatch.teamId,
        kind: teamMatch.kind,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        format: teamMatch.format,
        startsAt: teamMatch.startsAt,
        place: teamMatch.place,
        opponent: teamMatch.opponent,
        status: teamMatch.status,
        lineupId: teamMatch.lineupId,
        publishedAt: teamMatch.publishedAt,
        goalsFor: teamMatch.goalsFor,
        goalsAgainst: teamMatch.goalsAgainst,
        resultAt: teamMatch.resultAt,
        creatorId: user.id,
        creatorName: user.name,
        figureId: figure.id,
        figureName: figure.name,
      })
      .from(teamMatch)
      .leftJoin(user, eq(teamMatch.createdBy, user.id))
      .leftJoin(figure, eq(teamMatch.figurePlayerId, figure.id))
      .leftJoin(tournament, eq(teamMatch.tournamentId, tournament.id));
  }

  private toRecord(
    row: Awaited<ReturnType<DrizzleMatchesRepository['select']>>[number],
  ): MatchRecord {
    const { creatorId, creatorName, figureId, figureName, tournamentId, tournamentName, ...rest } =
      row;
    return {
      ...rest,
      tournament: tournamentId ? { id: tournamentId, name: tournamentName! } : null,
      createdBy: creatorId ? { id: creatorId, name: creatorName! } : null,
      figure: figureId ? { id: figureId, name: figureName! } : null,
    };
  }

  async create(teamId: string, createdBy: string, data: MatchData) {
    const [row] = await this.connection.db
      .insert(teamMatch)
      .values({ teamId, createdBy, ...data })
      .returning({ id: teamMatch.id });
    return row!.id;
  }

  async find(teamId: string, matchId: string) {
    const [row] = await this.select().where(
      and(eq(teamMatch.teamId, teamId), eq(teamMatch.id, matchId)),
    );
    return row ? this.toRecord(row) : null;
  }

  async listByTeam(teamId: string) {
    const rows = await this.select()
      .where(eq(teamMatch.teamId, teamId))
      .orderBy(asc(teamMatch.startsAt));
    return rows.map((row) => this.toRecord(row));
  }

  /** OpenMatchesQuery (para la invitación): programados que todavía no empiezan (D17). */
  async openMatches(teamId: string, now: Date) {
    return this.connection.db
      .select({ id: teamMatch.id, opponent: teamMatch.opponent, startsAt: teamMatch.startsAt })
      .from(teamMatch)
      .where(
        and(
          eq(teamMatch.teamId, teamId),
          eq(teamMatch.status, 'scheduled'),
          gt(teamMatch.startsAt, now),
        ),
      )
      .orderBy(asc(teamMatch.startsAt));
  }

  async update(matchId: string, patch: Partial<MatchData & Pick<MatchRecord, 'status'>>) {
    await this.connection.db.update(teamMatch).set(patch).where(eq(teamMatch.id, matchId));
  }

  async replies(matchIds: string[]) {
    const result = new Map<string, Map<string, MatchReply>>(matchIds.map((id) => [id, new Map()]));
    if (matchIds.length === 0) return result;
    const rows = await this.connection.db
      .select()
      .from(matchReply)
      .where(inArray(matchReply.matchId, matchIds));
    for (const row of rows) result.get(row.matchId)!.set(row.userId, row.reply);
    return result;
  }

  /** MatchGateway (para alineaciones): marcarla publicada. */
  async publish(matchId: string, lineupId: string, at: Date) {
    await this.connection.db
      .update(teamMatch)
      .set({ lineupId, publishedAt: at })
      .where(eq(teamMatch.id, matchId));
  }

  async setReply(matchId: string, userId: string, reply: MatchReply) {
    await this.connection.db
      .insert(matchReply)
      .values({ matchId, userId, reply })
      .onConflictDoUpdate({
        target: [matchReply.matchId, matchReply.userId],
        set: { reply, repliedAt: new Date() },
      });
  }

  async setResult(matchId: string, result: MatchResultData) {
    await this.connection.db.update(teamMatch).set(result).where(eq(teamMatch.id, matchId));
  }

  async ratings(matchId: string) {
    const rows = await this.connection.db
      .select({
        playerId: matchRating.playerUserId,
        playerName: player.name,
        rating: matchRating.rating,
        note: matchRating.note,
        ratedAt: matchRating.ratedAt,
        raterId: rater.id,
        raterName: rater.name,
      })
      .from(matchRating)
      .innerJoin(player, eq(matchRating.playerUserId, player.id))
      .leftJoin(rater, eq(matchRating.ratedBy, rater.id))
      .where(eq(matchRating.matchId, matchId));
    return rows.map(({ raterId, raterName, rating, ...row }) => ({
      ...row,
      rating: rating as MatchRatingValue,
      ratedBy: raterId ? { id: raterId, name: raterName! } : null,
    }));
  }

  async ratingsOf(matchIds: string[], playerId: string) {
    const result = new Map<string, MatchRatingValue>();
    if (matchIds.length === 0) return result;
    const rows = await this.connection.db
      .select({ matchId: matchRating.matchId, rating: matchRating.rating })
      .from(matchRating)
      .where(and(inArray(matchRating.matchId, matchIds), eq(matchRating.playerUserId, playerId)));
    for (const row of rows) result.set(row.matchId, row.rating as MatchRatingValue);
    return result;
  }

  async setRating(
    matchId: string,
    playerId: string,
    data: { rating: MatchRatingValue; note: string | null; ratedBy: string },
  ) {
    await this.connection.db
      .insert(matchRating)
      .values({ matchId, playerUserId: playerId, ...data })
      .onConflictDoUpdate({
        target: [matchRating.matchId, matchRating.playerUserId],
        set: { ...data, ratedAt: new Date() },
      });
  }

  async deleteRating(matchId: string, playerId: string) {
    await this.connection.db
      .delete(matchRating)
      .where(and(eq(matchRating.matchId, matchId), eq(matchRating.playerUserId, playerId)));
  }

  async playerRatings(teamId: string, playerId: string) {
    const rows = await this.connection.db
      .select({
        matchId: teamMatch.id,
        opponent: teamMatch.opponent,
        startsAt: teamMatch.startsAt,
        rating: matchRating.rating,
        note: matchRating.note,
      })
      .from(matchRating)
      .innerJoin(teamMatch, eq(matchRating.matchId, teamMatch.id))
      .where(
        and(
          eq(teamMatch.teamId, teamId),
          eq(matchRating.playerUserId, playerId),
          ne(teamMatch.status, 'cancelled'),
        ),
      )
      .orderBy(desc(teamMatch.startsAt));
    // Solo los partidos tienen evaluaciones: los entrenamientos (sin rival) no llegan aquí.
    return rows.map((row) => ({
      ...row,
      opponent: row.opponent ?? '',
      rating: row.rating as MatchRatingValue,
    }));
  }

  async tournaments(teamId: string) {
    return this.connection.db
      .select({ id: tournament.id, name: tournament.name, createdAt: tournament.createdAt })
      .from(tournament)
      .where(eq(tournament.teamId, teamId))
      .orderBy(desc(tournament.createdAt));
  }

  async findTournament(teamId: string, tournamentId: string) {
    const [row] = await this.connection.db
      .select({ id: tournament.id, name: tournament.name, createdAt: tournament.createdAt })
      .from(tournament)
      .where(and(eq(tournament.teamId, teamId), eq(tournament.id, tournamentId)));
    return row ?? null;
  }

  async createTournament(teamId: string, createdBy: string, name: string) {
    try {
      const [row] = await this.connection.db
        .insert(tournament)
        .values({ teamId, createdBy, name })
        .returning({ id: tournament.id, name: tournament.name, createdAt: tournament.createdAt });
      return row!;
    } catch (error) {
      if (isUniqueViolation(error)) return 'name-taken' as const;
      throw error;
    }
  }
}
