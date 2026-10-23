import { Inject, Injectable } from '@nestjs/common';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { coachAssessment } from '../../assessments/infrastructure/schema.js';
import { dataConsent } from '../../identity/infrastructure/consent.schema.js';
import { user } from '../../identity/infrastructure/schema.js';
import { playerRating, playerRatingValue } from '../../ratings/infrastructure/schema.js';
import { club, clubMembership, team } from '../../teams/infrastructure/schema.js';
import type { AccountRepository } from '../application/ports/account.ports.js';

const author = alias(user, 'author');

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
    await this.connection.db.delete(user).where(eq(user.id, userId));
  }
}
