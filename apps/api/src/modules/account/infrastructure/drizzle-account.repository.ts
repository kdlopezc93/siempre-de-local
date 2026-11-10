import { Inject, Injectable } from '@nestjs/common';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, eq, inArray, isNotNull, ne, or } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { coachAssessment } from '../../assessments/infrastructure/schema.js';
import { guardianship } from '../../families/infrastructure/schema.js';
import { dataConsent } from '../../identity/infrastructure/consent.schema.js';
import { user } from '../../identity/infrastructure/schema.js';
import { charge, chargeShare, payment } from '../../charges/infrastructure/schema.js';
import {
  matchAttendance,
  matchRating,
  matchReply,
  teamMatch,
  tournament,
} from '../../matches/infrastructure/schema.js';
import { playerRating, playerRatingValue } from '../../ratings/infrastructure/schema.js';
import { club, clubMembership, team } from '../../teams/infrastructure/schema.js';
import type { AccountRepository } from '../application/ports/account.ports.js';

const author = alias(user, 'author');
const teammate = alias(user, 'teammate');

@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async account(userId: string) {
    const [row] = await this.connection.db
      .select({ name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, userId));
    return row ?? null;
  }

  async consents(userId: string) {
    const rows = await this.connection.db
      .select({
        policyVersion: dataConsent.policyVersion,
        acceptedAt: dataConsent.acceptedAt,
        revokedAt: dataConsent.revokedAt,
      })
      .from(dataConsent)
      .where(eq(dataConsent.userId, userId))
      .orderBy(asc(dataConsent.acceptedAt));
    return rows.map((r) => ({
      policyVersion: r.policyVersion,
      acceptedAt: r.acceptedAt.toISOString(),
      revokedAt: r.revokedAt?.toISOString() ?? null,
    }));
  }

  async cardsAbout(userId: string) {
    const { db } = this.connection;
    const ratings = await db
      .select({
        id: playerRating.id,
        team: team.name,
        ratedAt: playerRating.ratedAt,
        ratedBy: author.name,
        notes: playerRating.notes,
        position: playerRating.position,
      })
      .from(playerRating)
      .innerJoin(team, eq(playerRating.teamId, team.id))
      .leftJoin(author, eq(playerRating.ratedBy, author.id))
      .where(eq(playerRating.playerUserId, userId))
      .orderBy(desc(playerRating.ratedAt));
    if (ratings.length === 0) return [];
    const values = await db
      .select()
      .from(playerRatingValue)
      .where(
        inArray(
          playerRatingValue.ratingId,
          ratings.map((r) => r.id),
        ),
      );
    return ratings.map(({ id, ratedAt, ...r }) => ({
      ...r,
      ratedAt: ratedAt.toISOString(),
      values: Object.fromEntries(
        values.filter((v) => v.ratingId === id).map((v) => [v.attributeCode, v.value]),
      ),
    }));
  }

  async assessmentsAbout(userId: string) {
    const rows = await this.connection.db
      .select({
        team: team.name,
        createdAt: coachAssessment.createdAt,
        by: author.name,
        primaryPosition: coachAssessment.primaryPosition,
        secondaryPositions: coachAssessment.secondaryPositions,
        confidence: coachAssessment.confidence,
        blind: coachAssessment.blind,
        notes: coachAssessment.notes,
      })
      .from(coachAssessment)
      .innerJoin(team, eq(coachAssessment.teamId, team.id))
      .leftJoin(author, eq(coachAssessment.coachUserId, author.id))
      .where(eq(coachAssessment.playerUserId, userId))
      .orderBy(desc(coachAssessment.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async matchesOf(userId: string) {
    const rows = await this.connection.db
      .select({
        team: team.name,
        opponent: teamMatch.opponent,
        startsAt: teamMatch.startsAt,
        reply: matchReply.reply,
        rating: matchRating.rating,
        ratedBy: author.name,
        note: matchRating.note,
        attendanceTakenAt: teamMatch.attendanceTakenAt,
        attended: matchAttendance.userId,
      })
      .from(teamMatch)
      .innerJoin(team, eq(teamMatch.teamId, team.id))
      .leftJoin(
        matchReply,
        and(eq(matchReply.matchId, teamMatch.id), eq(matchReply.userId, userId)),
      )
      .leftJoin(
        matchRating,
        and(eq(matchRating.matchId, teamMatch.id), eq(matchRating.playerUserId, userId)),
      )
      .leftJoin(author, eq(matchRating.ratedBy, author.id))
      .leftJoin(
        matchAttendance,
        and(eq(matchAttendance.matchId, teamMatch.id), eq(matchAttendance.userId, userId)),
      )
      .where(
        or(
          isNotNull(matchReply.userId),
          isNotNull(matchRating.playerUserId),
          isNotNull(matchAttendance.userId),
        ),
      )
      .orderBy(desc(teamMatch.startsAt));
    return rows.map(({ attendanceTakenAt, attended, ...r }) => ({
      ...r,
      startsAt: r.startsAt.toISOString(),
      came: attendanceTakenAt ? attended !== null : null,
    }));
  }

  async chargesOf(userId: string) {
    const { db } = this.connection;
    const shares = await db
      .select({
        chargeId: charge.id,
        team: team.name,
        kind: charge.kind,
        title: charge.title,
        opponent: teamMatch.opponent,
        startsAt: teamMatch.startsAt,
        tournament: tournament.name,
        dueOn: charge.dueOn,
        createdAt: charge.createdAt,
        cancelledAt: charge.cancelledAt,
        owner: chargeShare.userId,
        ownerName: teammate.name,
        amount: chargeShare.amount,
        note: chargeShare.note,
        sponsorId: chargeShare.sponsorId,
        teamCovers: chargeShare.teamCovers,
      })
      .from(chargeShare)
      .innerJoin(charge, eq(chargeShare.chargeId, charge.id))
      .innerJoin(team, eq(charge.teamId, team.id))
      .innerJoin(teammate, eq(chargeShare.userId, teammate.id))
      .leftJoin(teamMatch, eq(charge.matchId, teamMatch.id))
      .leftJoin(tournament, eq(charge.tournamentId, tournament.id))
      .where(or(eq(chargeShare.userId, userId), eq(chargeShare.sponsorId, userId)))
      .orderBy(desc(charge.createdAt));
    if (shares.length === 0) return [];
    const payments = await db
      .select({
        chargeId: payment.chargeId,
        userId: payment.userId,
        amount: payment.amount,
        method: payment.method,
        paidOn: payment.paidOn,
        status: payment.status,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .where(
        inArray(
          payment.chargeId,
          shares.map((s) => s.chargeId),
        ),
      )
      .orderBy(asc(payment.createdAt));
    return shares.map((s) => {
      const mine = s.owner === userId;
      // Si a quien pregunta le cubrieron la parte, la ve cubierta: sin quién ni sus pagos.
      const covered = mine && (s.teamCovers || s.sponsorId !== null);
      return {
        team: s.team,
        kind: s.kind,
        title: s.title,
        match: s.startsAt ? { opponent: s.opponent, startsAt: s.startsAt.toISOString() } : null,
        tournament: s.tournament,
        dueOn: s.dueOn,
        createdAt: s.createdAt.toISOString(),
        cancelled: s.cancelledAt !== null,
        forPlayer: mine ? null : s.ownerName,
        amount: s.amount,
        note: s.note,
        covered,
        payments: covered
          ? []
          : payments
              .filter((p) => p.chargeId === s.chargeId && p.userId === s.owner)
              .map(({ chargeId: _c, userId: _u, createdAt, ...p }) => ({
                ...p,
                createdAt: createdAt.toISOString(),
              })),
      };
    });
  }

  async clubsOnlyManagedBy(userId: string) {
    const { db } = this.connection;
    const mine = await db
      .select({ clubId: clubMembership.clubId, name: club.name })
      .from(clubMembership)
      .innerJoin(club, eq(clubMembership.clubId, club.id))
      .where(eq(clubMembership.userId, userId));
    if (mine.length === 0) return [];
    const others = await db
      .select({ clubId: clubMembership.clubId })
      .from(clubMembership)
      .where(
        and(
          inArray(
            clubMembership.clubId,
            mine.map((m) => m.clubId),
          ),
          ne(clubMembership.userId, userId),
        ),
      );
    const covered = new Set(others.map((o) => o.clubId));
    return mine.filter((m) => !covered.has(m.clubId)).map((m) => m.name);
  }

  async deleteUser(userId: string) {
    return this.connection.db.transaction(async (tx) => {
      const mine = await tx
        .select({ minorUserId: guardianship.minorUserId })
        .from(guardianship)
        .where(eq(guardianship.guardianUserId, userId));
      const ids = mine.map((m) => m.minorUserId);
      // Los que tienen otro acudiente se quedan con él.
      const covered =
        ids.length === 0
          ? []
          : await tx
              .select({ minorUserId: guardianship.minorUserId })
              .from(guardianship)
              .where(
                and(
                  inArray(guardianship.minorUserId, ids),
                  ne(guardianship.guardianUserId, userId),
                ),
              );
      const keep = new Set(covered.map((c) => c.minorUserId));
      const orphans = ids.filter((id) => !keep.has(id));
      if (orphans.length > 0) {
        await tx.delete(user).where(and(inArray(user.id, orphans), eq(user.managed, true)));
      }
      await tx.delete(user).where(eq(user.id, userId));
      return { minors: orphans.length };
    });
  }

  async minorOf(guardianUserId: string, minorUserId: string) {
    const [row] = await this.connection.db
      .select({ name: user.name })
      .from(guardianship)
      .innerJoin(user, eq(guardianship.minorUserId, user.id))
      .where(
        and(
          eq(guardianship.guardianUserId, guardianUserId),
          eq(guardianship.minorUserId, minorUserId),
        ),
      );
    return row ?? null;
  }
}
