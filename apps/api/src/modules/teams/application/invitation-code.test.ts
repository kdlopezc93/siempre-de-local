import { describe, expect, it } from 'vitest';

import {
  generateInvitationCode,
  hashInvitationCode,
  normalizeInvitationCode,
} from './invitation-code.js';
import { invitationStatus } from './invitation-status.js';

describe('códigos de invitación', () => {
  it('10 caracteres sin los que se confunden al dictar', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInvitationCode()).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
    }
  });

  it('no se repiten en la práctica', () => {
    const codes = new Set(Array.from({ length: 2000 }, generateInvitationCode));
    expect(codes.size).toBe(2000);
  });

  it('se aceptan escritos con minúsculas, espacios o guiones', () => {
    expect(normalizeInvitationCode(' k7q2m-9xdab ')).toBe('K7Q2M9XDAB');
    expect(hashInvitationCode('k7q2m-9xdab')).toBe(hashInvitationCode('K7Q2M9XDAB'));
    expect(hashInvitationCode('K7Q2M9XDAB')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('invitationStatus', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const base = {
    expiresAt: new Date('2026-10-28T12:00:00Z'),
    maxUses: 2,
    usedCount: 0,
    revokedAt: null,
  };

  it('activa, vencida, agotada y revocada, en ese orden de prioridad', () => {
    expect(invitationStatus(base, now)).toBe('active');
    expect(invitationStatus({ ...base, usedCount: 2 }, now)).toBe('used_up');
    expect(invitationStatus({ ...base, usedCount: 2, expiresAt: now }, now)).toBe('expired');
    expect(invitationStatus({ ...base, expiresAt: now, revokedAt: now }, now)).toBe('revoked');
  });
});
