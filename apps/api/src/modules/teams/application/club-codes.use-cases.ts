import { Inject, Injectable } from '@nestjs/common';
import type { ClubCodeStatus, ClubCodeSummary, CreateClubCodeRequestSchema } from '@sdl/contracts';
import type { z } from 'zod';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import { generateInvitationCode, hashInvitationCode } from './invitation-code.js';
import {
  CLUB_CODES_REPOSITORY,
  type ClubCodeRecord,
  type ClubCodesRepository,
} from './ports/club-codes.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quien pide: solo el administrador de la plataforma genera códigos de alta. */
export interface PlatformActor {
  userId: string;
  platformAdmin: boolean;
}

export function clubCodeStatus(code: ClubCodeRecord, now: Date): ClubCodeStatus {
  if (code.revokedAt) return 'revoked';
  if (code.usedAt) return 'used';
  return code.expiresAt <= now ? 'expired' : 'active';
}

function toSummary(code: ClubCodeRecord, now: Date): ClubCodeSummary {
  return {
    id: code.id,
    note: code.note,
    status: clubCodeStatus(code, now),
    expiresAt: code.expiresAt.toISOString(),
    createdAt: code.createdAt.toISOString(),
    club: code.club,
  };
}

/**
 * Códigos de alta (Kevin, 2026-10-29): crear un club desde la app pide uno. Mismo formato que
 * las invitaciones (10 caracteres sin 0/O ni 1/I/L), pero en otra tabla: un código de equipo no
 * abre un club ni al revés.
 */
@Injectable()
export class ClubCodes {
  constructor(
    @Inject(CLUB_CODES_REPOSITORY) private readonly codes: ClubCodesRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async create(
    actor: PlatformActor,
    request: z.output<typeof CreateClubCodeRequestSchema>,
    now = new Date(),
  ): Promise<{ clubCode: ClubCodeSummary; code: string }> {
    assertPlatformAdmin(actor);
    const code = generateInvitationCode();
    const created = await this.codes.create({
      codeHash: hashInvitationCode(code),
      note: request.note || null,
      createdBy: actor.userId,
      expiresAt: new Date(now.getTime() + request.expiresInDays * DAY_MS),
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'club_code.created',
      entity: 'club_signup_code',
      entityId: created.id,
      meta: {},
    });
    return { clubCode: toSummary(created, now), code };
  }

  async list(actor: PlatformActor, now = new Date()): Promise<ClubCodeSummary[]> {
    assertPlatformAdmin(actor);
    return (await this.codes.list()).map((code) => toSummary(code, now));
  }

  async revoke(actor: PlatformActor, id: string, now = new Date()): Promise<void> {
    assertPlatformAdmin(actor);
    const code = await this.codes.find(id);
    if (!code) throw new NotFoundError('Ese código no existe', 'CLUB_CODE_NOT_FOUND');
    if (!code.revokedAt && !code.usedAt) await this.codes.revoke(id, now);
  }
}

function assertPlatformAdmin(actor: PlatformActor) {
  if (!actor.platformAdmin) throw new ForbiddenError('No tienes permiso para esto');
}
