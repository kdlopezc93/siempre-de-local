import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { user } from '../../identity/infrastructure/schema.js';
import { teamMatch, tournament } from '../../matches/infrastructure/schema.js';
import type {
  ChargeData,
  ChargeRecord,
  ChargesRepository,
  PaymentRecord,
} from '../application/ports/charges.repository.js';
import { charge, chargeShare, payment } from './schema.js';

const reporter = alias(user, 'reporter');
const reviewer = alias(user, 'reviewer');
const sponsor = alias(user, 'sponsor');
const matchTournament = alias(tournament, 'match_tournament');

@Injectable()
export class DrizzleChargesRepository implements ChargesRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async create(
    teamId: string,
    createdBy: string,
    data: ChargeData,
    shares: { userId: string; amount: number; sponsorId: string | null; teamCovers: boolean }[],
  ) {
    return this.connection.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(charge)
        .values({ ...data, teamId, createdBy })
        .returning({ id: charge.id });
      await tx.insert(chargeShare).values(shares.map((s) => ({ ...s, chargeId: row!.id })));
      return row!.id;
    });
  }

  private select() {
    return this.connection.db
      .select({
        id: charge.id,
        teamId: charge.teamId,
        kind: charge.kind,
        title: charge.title,
        matchId: teamMatch.id,
        opponent: teamMatch.opponent,
        startsAt: teamMatch.startsAt,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        matchTournamentId: matchTournament.id,
        matchTournamentName: matchTournament.name,
        split: charge.split,
        amount: charge.amount,
        dueOn: charge.dueOn,
        createdAt: charge.createdAt,
        cancelledAt: charge.cancelledAt,
        dueReminder: charge.dueReminder,
      })
      .from(charge)
      .leftJoin(teamMatch, eq(charge.matchId, teamMatch.id))
      .leftJoin(tournament, eq(charge.tournamentId, tournament.id))
      .leftJoin(matchTournament, eq(teamMatch.tournamentId, matchTournament.id));
  }

  private toRecord(row: Awaited<ReturnType<DrizzleChargesRepository['select']>>[number]) {
    const {
      matchId,
      opponent,
      startsAt,
      tournamentId,
      tournamentName,
      matchTournamentId,
      matchTournamentName,
      ...rest
    } = row;
    return {
      ...rest,
      match: matchId ? { id: matchId, opponent, startsAt: startsAt! } : null,
      tournament: tournamentId ? { id: tournamentId, name: tournamentName! } : null,
      matchTournament: matchTournamentId
        ? { id: matchTournamentId, name: matchTournamentName! }
        : null,
    } satisfies ChargeRecord;
  }

  async list(teamId: string) {
    const rows = await this.select()
      .where(eq(charge.teamId, teamId))
      .orderBy(desc(charge.createdAt));
    return rows.map((r) => this.toRecord(r));
  }

  async find(teamId: string, chargeId: string) {
    const [row] = await this.select().where(
      and(eq(charge.teamId, teamId), eq(charge.id, chargeId)),
    );
    return row ? this.toRecord(row) : null;
  }

  async update(
    chargeId: string,
    patch: Partial<Pick<ChargeRecord, 'title' | 'dueOn' | 'cancelledAt'>>,
  ) {
    await this.connection.db.update(charge).set(patch).where(eq(charge.id, chargeId));
  }

  async shares(chargeIds: string[]) {
    if (chargeIds.length === 0) return [];
    const rows = await this.connection.db
      .select({
        chargeId: chargeShare.chargeId,
        userId: chargeShare.userId,
        name: user.name,
        amount: chargeShare.amount,
        note: chargeShare.note,
        sponsorId: sponsor.id,
        sponsorName: sponsor.name,
        teamCovers: chargeShare.teamCovers,
      })
      .from(chargeShare)
      .innerJoin(user, eq(chargeShare.userId, user.id))
      .leftJoin(sponsor, eq(chargeShare.sponsorId, sponsor.id))
      .where(inArray(chargeShare.chargeId, chargeIds));
    return rows.map(({ sponsorId, sponsorName, ...rest }) => ({
      ...rest,
      sponsor: sponsorId ? { id: sponsorId, name: sponsorName! } : null,
    }));
  }

  async payments(chargeIds: string[]): Promise<PaymentRecord[]> {
    if (chargeIds.length === 0) return [];
    const rows = await this.connection.db
      .select({
        id: payment.id,
        chargeId: payment.chargeId,
        userId: payment.userId,
        amount: payment.amount,
        method: payment.method,
        paidOn: payment.paidOn,
        status: payment.status,
        reporterId: reporter.id,
        reporterName: reporter.name,
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .leftJoin(reporter, eq(payment.reportedBy, reporter.id))
      .leftJoin(reviewer, eq(payment.reviewedBy, reviewer.id))
      .where(inArray(payment.chargeId, chargeIds))
      .orderBy(desc(payment.createdAt));
    return rows.map(({ reporterId, reporterName, reviewerId, reviewerName, ...rest }) => ({
      ...rest,
      reportedBy: reporterId ? { id: reporterId, name: reporterName! } : null,
      reviewedBy: reviewerId ? { id: reviewerId, name: reviewerName! } : null,
    }));
  }

  async setShare(chargeId: string, userId: string, amount: number, note: string | null) {
    await this.connection.db
      .insert(chargeShare)
      .values({ chargeId, userId, amount, note })
      .onConflictDoUpdate({
        target: [chargeShare.chargeId, chargeShare.userId],
        set: { amount, note },
      });
  }

  async setSponsor(
    chargeId: string,
    userId: string,
    value: { sponsorId: string | null; teamCovers: boolean },
  ) {
    await this.connection.db
      .update(chargeShare)
      .set(value)
      .where(and(eq(chargeShare.chargeId, chargeId), eq(chargeShare.userId, userId)));
  }

  async addPayment(input: Parameters<ChargesRepository['addPayment']>[0]) {
    const { at, ...values } = input;
    const [row] = await this.connection.db
      .insert(payment)
      .values({ ...values, createdAt: at, reviewedAt: values.reviewedBy ? at : null })
      .returning({ id: payment.id });
    return row!.id;
  }

  async reviewPayment(
    paymentId: string,
    status: 'confirmed' | 'rejected',
    reviewedBy: string,
    at: Date,
  ) {
    await this.connection.db
      .update(payment)
      .set({ status, reviewedBy, reviewedAt: at })
      .where(eq(payment.id, paymentId));
  }

  async chargesOf(teamId: string, userId: string) {
    const involved = this.connection.db
      .select({ id: chargeShare.chargeId })
      .from(chargeShare)
      .where(or(eq(chargeShare.userId, userId), eq(chargeShare.sponsorId, userId)));
    const rows = await this.select()
      .where(
        and(eq(charge.teamId, teamId), isNull(charge.cancelledAt), inArray(charge.id, involved)),
      )
      .orderBy(desc(charge.createdAt));
    return rows.map((r) => this.toRecord(r));
  }

  async dueOn(days: string[]) {
    if (days.length === 0) return [];
    const rows = await this.select().where(
      and(inArray(charge.dueOn, days), isNull(charge.cancelledAt)),
    );
    return rows.map((r) => this.toRecord(r));
  }

  async markDueReminder(chargeId: string, key: string) {
    await this.connection.db
      .update(charge)
      .set({ dueReminder: key })
      .where(eq(charge.id, chargeId));
  }

  async matchInTeam(teamId: string, matchId: string) {
    const [row] = await this.connection.db
      .select({ id: teamMatch.id })
      .from(teamMatch)
      .where(and(eq(teamMatch.teamId, teamId), eq(teamMatch.id, matchId)));
    return row !== undefined;
  }

  async tournamentInTeam(teamId: string, tournamentId: string) {
    const [row] = await this.connection.db
      .select({ id: tournament.id })
      .from(tournament)
      .where(and(eq(tournament.teamId, teamId), eq(tournament.id, tournamentId)));
    return row !== undefined;
  }
}
