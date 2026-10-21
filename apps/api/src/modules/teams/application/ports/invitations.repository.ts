import type { MatchFormat, TeamRole } from '@sdl/contracts';

import type { InvitationState } from '../invitation-status.js';

export interface InvitationRecord extends InvitationState {
  id: string;
  teamId: string;
  role: TeamRole;
  createdAt: Date;
}

export interface InvitationWithTeam extends InvitationRecord {
  team: { id: string; name: string; format: MatchFormat; clubId: string; clubName: string };
}

export type RedeemOutcome = 'joined' | 'already-member' | 'unavailable';

export interface InvitationsRepository {
  create(input: {
    teamId: string;
    role: TeamRole;
    codeHash: string;
    createdBy: string;
    expiresAt: Date;
    maxUses: number;
  }): Promise<InvitationRecord>;
  listByTeam(teamId: string): Promise<InvitationRecord[]>;
  findInTeam(teamId: string, invitationId: string): Promise<InvitationRecord | null>;
  revoke(invitationId: string, at: Date): Promise<void>;
  findByCodeHash(codeHash: string): Promise<InvitationWithTeam | null>;
  /**
   * Suma el usuario al equipo con el rol de la invitación y gasta un uso, en una
   * transacción. Si ya es miembro activo con ese rol no gasta nada. 'unavailable'
   * si otra persona se llevó el último uso o la invitación dejó de valer.
   */
  redeem(invitation: InvitationRecord, userId: string, now: Date): Promise<RedeemOutcome>;
}

export const INVITATIONS_REPOSITORY = Symbol('INVITATIONS_REPOSITORY');
