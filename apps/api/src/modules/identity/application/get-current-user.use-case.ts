import { Inject, Injectable } from '@nestjs/common';
import { POLICY_VERSION, type MeResponse } from '@sdl/contracts';

import { CONSENT_REPOSITORY, type ConsentRepository } from './ports/consent.repository.js';
import type { AuthSession } from './ports/identity-provider.port.js';
import { MEMBERSHIPS_QUERY, type MembershipsQuery } from './ports/memberships.query.js';

@Injectable()
export class GetCurrentUser {
  constructor(
    @Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository,
    @Inject(MEMBERSHIPS_QUERY) private readonly memberships: MembershipsQuery,
  ) {}

  async execute(session: AuthSession): Promise<MeResponse> {
    const { id, name, email } = session.user;
    const [consent, memberships] = await Promise.all([
      this.consents.findActive(id, POLICY_VERSION),
      this.memberships.listForUser(id),
    ]);
    return {
      user: { id, name, email },
      consent: consent && {
        policyVersion: consent.policyVersion,
        acceptedAt: consent.acceptedAt.toISOString(),
      },
      ...memberships,
    };
  }
}
