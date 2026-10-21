import { Inject, Injectable } from '@nestjs/common';
import {
  POLICY_VERSION,
  type AcceptConsentRequest,
  type AcceptConsentResponse,
} from '@sdl/contracts';

import { BusinessRuleError } from '../../../shared/errors/application-errors.js';
import type { ConsentChecker } from '../../../shared/consent/consent.port.js';
import { CONSENT_REPOSITORY, type ConsentRepository } from './ports/consent.repository.js';

@Injectable()
export class AcceptConsent implements ConsentChecker {
  constructor(@Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository) {}

  /** Idempotente: aceptar dos veces la misma versión devuelve la primera aceptación. */
  async execute(
    userId: string,
    request: AcceptConsentRequest,
    now = new Date(),
  ): Promise<AcceptConsentResponse> {
    // Solo se acepta la versión que la persona está viendo y que sigue vigente.
    if (request.policyVersion !== POLICY_VERSION) {
      throw new BusinessRuleError(
        'La política cambió mientras la leías. Recarga para ver la versión vigente.',
        'POLICY_VERSION_OUTDATED',
      );
    }
    const consent =
      (await this.consents.findActive(userId, POLICY_VERSION)) ??
      (await this.consents.record(userId, POLICY_VERSION, now));
    return {
      consent: {
        policyVersion: consent.policyVersion,
        acceptedAt: consent.acceptedAt.toISOString(),
      },
    };
  }

  async hasCurrentConsent(userId: string): Promise<boolean> {
    return (await this.consents.findActive(userId, POLICY_VERSION)) !== null;
  }
}
