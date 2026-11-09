import { Inject, Injectable } from '@nestjs/common';
import {
  GUARDIAN_AUTHORIZATION_VERSION,
  type RegisterMinorRequestSchema,
  type RegisterMinorResponse,
} from '@sdl/contracts';
import { formatBirthYears } from '@sdl/domain';
import type { z } from 'zod';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { CONSENT_CHECKER, type ConsentChecker } from '../../../shared/consent/consent.port.js';
import { BusinessRuleError, ForbiddenError } from '../../../shared/errors/application-errors.js';
import { InvitationRedemption } from '../../teams/application/invitations.use-cases.js';
import {
  INVITATIONS_REPOSITORY,
  type InvitationsRepository,
} from '../../teams/application/ports/invitations.repository.js';
import { FAMILIES_REPOSITORY, type FamiliesRepository } from './ports/families.repository.js';

/** Mayor de edad en Colombia: 18 años. Con el año basta (no se guarda la fecha). */
const ADULT_AGE = 18;

/**
 * Inscribir a un hijo menor con una invitación para acudientes (escuelas, 2026-11-08, `08` §10):
 * el acudiente entra con su Google, tiene aceptada la política (como adulto) y acepta la
 * autorización del representante legal. El niño no tiene cuenta: queda a su cargo y entra al
 * grupo como jugador.
 */
@Injectable()
export class RegisterMinor {
  constructor(
    private readonly redemption: InvitationRedemption,
    @Inject(INVITATIONS_REPOSITORY) private readonly invitations: InvitationsRepository,
    @Inject(FAMILIES_REPOSITORY) private readonly families: FamiliesRepository,
    @Inject(CONSENT_CHECKER) private readonly consent: ConsentChecker,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(
    guardianUserId: string,
    code: string,
    request: z.output<typeof RegisterMinorRequestSchema>,
    now = new Date(),
  ): Promise<RegisterMinorResponse> {
    const invitation = await this.redemption.usable(code, now);
    if (!invitation.forGuardians) {
      throw new BusinessRuleError(
        'Este enlace no es para inscribir niños. Pídele al profe el enlace para acudientes.',
        'NOT_A_GUARDIAN_INVITATION',
      );
    }
    // Ley 1581: el acudiente, como adulto, acepta la política; y por el niño, la autorización.
    if (!(await this.consent.hasCurrentConsent(guardianUserId))) {
      throw new ForbiddenError(
        'Antes de inscribir a tu hijo acepta la política de datos.',
        'CONSENT_REQUIRED',
      );
    }
    if (request.authorizationVersion !== GUARDIAN_AUTHORIZATION_VERSION) {
      throw new BusinessRuleError(
        'Acepta la autorización vigente del representante legal para inscribirlo.',
        'GUARDIAN_AUTHORIZATION_REQUIRED',
      );
    }
    const { name, birthYear } = request.child;
    const year = now.getFullYear();
    if (birthYear > year) {
      throw new BusinessRuleError('Revisa el año de nacimiento.', 'INVALID_BIRTH_YEAR');
    }
    if (year - birthYear >= ADULT_AGE) {
      throw new BusinessRuleError(
        'Ya es mayor de edad: que entre al grupo con su propia cuenta.',
        'MINOR_IS_ADULT',
      );
    }
    const years = invitation.team.birthYears;
    if (years && (birthYear > years.to || (years.from !== null && birthYear < years.from))) {
      throw new BusinessRuleError(
        `${invitation.team.name} es de nacidos en ${formatBirthYears(years)}. Pídele al profe el enlace de su categoría.`,
        'CHILD_NOT_IN_CATEGORY',
      );
    }

    const existing = await this.families.findChild(guardianUserId, name, birthYear);
    const minorId =
      existing ??
      (await this.families.createMinor({
        guardianUserId,
        name,
        birthYear,
        relationship: request.relationship,
        authorizationVersion: request.authorizationVersion,
        at: now,
      }));
    const outcome = await this.invitations.redeem(invitation, minorId, now);
    if (outcome === 'unavailable') {
      throw new BusinessRuleError(
        'Esta invitación ya se usó todas las veces. Pídele otra al profe.',
        'INVITATION_USED_UP',
      );
    }
    // Sin datos del niño en la auditoría: quién, a qué grupo y que se inscribió.
    await this.audit.record({
      actorUserId: guardianUserId,
      action: 'minor.registered',
      entity: 'user',
      entityId: minorId,
      teamId: invitation.teamId,
      meta: { invitationId: invitation.id, newMinor: existing === null },
    });
    return {
      teamId: invitation.teamId,
      minorId,
      alreadyMember: outcome === 'already-member',
    };
  }
}
