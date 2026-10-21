import type { InvitationStatus } from '@sdl/contracts';

export interface InvitationState {
  expiresAt: Date;
  maxUses: number;
  usedCount: number;
  revokedAt: Date | null;
}

/** Revocada pesa más que vencida, y vencida más que agotada. */
export function invitationStatus(invitation: InvitationState, now: Date): InvitationStatus {
  if (invitation.revokedAt) return 'revoked';
  if (invitation.expiresAt <= now) return 'expired';
  if (invitation.usedCount >= invitation.maxUses) return 'used_up';
  return 'active';
}
