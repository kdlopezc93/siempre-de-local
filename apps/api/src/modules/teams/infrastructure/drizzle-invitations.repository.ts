import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  InvitationRecord,
  InvitationsRepository,
  InvitationWithTeam,
  RedeemOutcome,
} from '../application/ports/invitations.repository.js';
import { club, invitation, team, teamMembership } from './schema.js';

const RECORD = {
  id: invitation.id,
  teamId: invitation.teamId,
  role: invitation.role,
  expiresAt: invitation.expiresAt,
  maxUses: invitation.maxUses,
  usedCount: invitation.usedCount,
  revokedAt: invitation.revokedAt,
  createdAt: invitation.createdAt,
};

@Injectable()
export class DrizzleInvitationsRepository implements InvitationsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async create(input: Parameters<InvitationsRepository['create']>[0]): Promise<InvitationRecord> {
    const [row] = await this.connection.db.insert(invitation).values(input).returning(RECORD);
    return row!;
  }

  listByTeam(teamId: string): Promise<InvitationRecord[]> {
    return this.connection.db
      .select(RECORD)
      .from(invitation)
      .where(eq(invitation.teamId, teamId))
      .orderBy(desc(invitation.createdAt));
  }

  async findInTeam(teamId: string, invitationId: string): Promise<InvitationRecord | null> {
    const [row] = await this.connection.db
      .select(RECORD)
      .from(invitation)
      .where(and(eq(invitation.teamId, teamId), eq(invitation.id, invitationId)));
    return row ?? null;
  }

  async revoke(invitationId: string, at: Date): Promise<void> {
    await this.connection.db
      .update(invitation)
      .set({ revokedAt: at })
      .where(and(eq(invitation.id, invitationId), isNull(invitation.revokedAt)));
  }

  async findByCodeHash(codeHash: string): Promise<InvitationWithTeam | null> {
    const [row] = await this.connection.db
      .select({
        ...RECORD,
        team: {
          id: team.id,
          name: team.name,
          format: team.format,
          clubId: club.id,
          clubName: club.name,
        },
      })
      .from(invitation)
      .innerJoin(team, eq(invitation.teamId, team.id))
      .innerJoin(club, eq(team.clubId, club.id))
      .where(eq(invitation.codeHash, codeHash));
    return row ?? null;
  }

  redeem(inv: InvitationRecord, userId: string, now: Date): Promise<RedeemOutcome> {
    return this.connection.db.transaction(async (tx) => {
      const membershipKey = and(
        eq(teamMembership.teamId, inv.teamId),
        eq(teamMembership.userId, userId),
        eq(teamMembership.role, inv.role),
      );
      const [existing] = await tx
        .select({ leftAt: teamMembership.leftAt })
        .from(teamMembership)
        .where(membershipKey)
        .for('update');
      if (existing && !existing.leftAt) return 'already-member';

      // Gasta un uso solo si todavía vale: dos personas no pueden pasarse del límite.
      const spent = await tx
        .update(invitation)
        .set({ usedCount: sql`${invitation.usedCount} + 1` })
        .where(
          and(
            eq(invitation.id, inv.id),
            isNull(invitation.revokedAt),
            gt(invitation.expiresAt, now),
            lt(invitation.usedCount, invitation.maxUses),
          ),
        )
        .returning({ id: invitation.id });
      if (spent.length === 0) return 'unavailable';

      if (existing) {
        // Vuelve al equipo: se reactiva la membresía anterior.
        await tx.update(teamMembership).set({ leftAt: null, joinedAt: now }).where(membershipKey);
      } else {
        await tx
          .insert(teamMembership)
          .values({ teamId: inv.teamId, userId, role: inv.role, joinedAt: now });
      }
      return 'joined';
    });
  }
}
