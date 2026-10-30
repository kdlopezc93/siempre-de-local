import { Inject, Injectable } from '@nestjs/common';
import type { TeamRole } from '@sdl/contracts';
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
  alsoPlays: invitation.alsoPlays,
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
          archived: sql<boolean>`${team.archivedAt} is not null`,
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
      const key = (role: TeamRole, who = userId) =>
        and(
          eq(teamMembership.teamId, inv.teamId),
          eq(teamMembership.userId, who),
          eq(teamMembership.role, role),
        );
      const active = await tx
        .select({ role: teamMembership.role })
        .from(teamMembership)
        .where(
          and(
            eq(teamMembership.teamId, inv.teamId),
            eq(teamMembership.userId, userId),
            isNull(teamMembership.leftAt),
          ),
        )
        .for('update');
      const has = (role: TeamRole) => active.some((r) => r.role === role);
      // El entrenador ya es del cuerpo técnico: una de asistente no le cambia nada.
      if (has(inv.role) || (inv.role === 'assistant' && has('coach'))) return 'already-member';

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

      /** Prende un rol: reactiva la fila anterior (con su dorsal) o crea una nueva. */
      const activate = async (role: TeamRole, who = userId) => {
        const [row] = await tx
          .select({ leftAt: teamMembership.leftAt })
          .from(teamMembership)
          .where(key(role, who));
        if (!row) {
          await tx
            .insert(teamMembership)
            .values({ teamId: inv.teamId, userId: who, role, joinedAt: now });
        } else if (row.leftAt) {
          await tx
            .update(teamMembership)
            .set({ leftAt: null, joinedAt: now })
            .where(key(role, who));
        }
      };
      const deactivate = (role: TeamRole, who = userId) =>
        tx
          .update(teamMembership)
          .set({ leftAt: now })
          .where(and(key(role, who), isNull(teamMembership.leftAt)));

      if (inv.role === 'coach') {
        // Un solo entrenador: el anterior queda de asistente (como al pasar el mando).
        const coaches = await tx
          .select({ userId: teamMembership.userId })
          .from(teamMembership)
          .where(
            and(
              eq(teamMembership.teamId, inv.teamId),
              eq(teamMembership.role, 'coach'),
              isNull(teamMembership.leftAt),
            ),
          );
        for (const { userId: previous } of coaches) {
          await deactivate('coach', previous);
          await activate('assistant', previous);
        }
        await deactivate('assistant');
      }
      // Vuelve al equipo: `activate` reactiva la membresía anterior.
      await activate(inv.role);
      if (inv.alsoPlays) await activate('player');
      return 'joined';
    });
  }
}
