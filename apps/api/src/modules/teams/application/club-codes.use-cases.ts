import { Inject, Injectable } from '@nestjs/common';
import type {
  ClubCodePreviewResponse,
  ClubCodeStatus,
  ClubCodeSummary,
  CreateClubCodeRequestSchema,
  CreateClubRequestSchema,
  CreateClubResponse,
} from '@sdl/contracts';
import type { z } from 'zod';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { CONSENT_CHECKER, type ConsentChecker } from '../../../shared/consent/consent.port.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
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

/**
 * Crear mi club con un código de alta (Kevin, 2026-10-29): el club con su ciudad, su primer
 * equipo, y quien lo crea de dueño y entrenador. Dueño de un solo club.
 */
@Injectable()
export class CreateClub {
  constructor(
    @Inject(CLUB_CODES_REPOSITORY) private readonly codes: ClubCodesRepository,
    @Inject(CONSENT_CHECKER) private readonly consent: ConsentChecker,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  /** Público: si el código sirve, antes de llenar el formulario. */
  async preview(code: string, now = new Date()): Promise<ClubCodePreviewResponse> {
    const found = await this.usable(code, now);
    return { expiresAt: found.expiresAt.toISOString() };
  }

  async execute(
    userId: string,
    request: z.output<typeof CreateClubRequestSchema>,
    now = new Date(),
  ): Promise<CreateClubResponse> {
    const code = await this.usable(request.code, now);
    // Ley 1581: sin autorización previa no se guarda nada de su equipo (04 §1.2).
    if (!(await this.consent.hasCurrentConsent(userId))) {
      throw new ForbiddenError(
        'Antes de crear tu club acepta la política de datos.',
        'CONSENT_REQUIRED',
      );
    }
    const outcome = await this.codes.createClub(
      code.id,
      userId,
      {
        clubName: request.clubName,
        city: request.city,
        teamName: request.teamName,
        category: request.category || null,
        format: request.format,
        season: request.season,
        alsoPlays: request.alsoPlays,
      },
      now,
    );
    if (outcome === 'unavailable') throw unusable('used');
    if (outcome === 'limit') {
      throw new ConflictError(
        'Ya eres dueño de un club. Para abrir otro equipo, créalo dentro de tu club.',
        'CLUB_LIMIT_REACHED',
      );
    }
    await this.audit.record({
      actorUserId: userId,
      action: 'club.created',
      entity: 'club',
      entityId: outcome.clubId,
      teamId: outcome.teamId,
      meta: { clubCodeId: code.id },
    });
    return outcome;
  }

  private async usable(raw: string, now: Date) {
    const code = await this.codes.findByCodeHash(hashInvitationCode(raw));
    if (!code) {
      throw new NotFoundError('Este código no existe. Revisa el mensaje.', 'CLUB_CODE_NOT_FOUND');
    }
    const status = clubCodeStatus(code, now);
    if (status !== 'active') throw unusable(status);
    return code;
  }
}

function unusable(status: 'expired' | 'used' | 'revoked'): BusinessRuleError {
  const messages = {
    expired: ['Este código ya venció. Pide uno nuevo.', 'CLUB_CODE_EXPIRED'],
    used: ['Este código ya se usó para crear un club. Pide uno nuevo.', 'CLUB_CODE_USED'],
    revoked: ['Este código fue anulado. Pide uno nuevo.', 'CLUB_CODE_REVOKED'],
  } as const;
  const [message, code] = messages[status];
  return new BusinessRuleError(message, code);
}

function assertPlatformAdmin(actor: PlatformActor) {
  if (!actor.platformAdmin) throw new ForbiddenError('No tienes permiso para esto');
}
