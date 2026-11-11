import { Inject, Injectable } from '@nestjs/common';
import { POLICY_VERSION, type MeResponse } from '@sdl/contracts';

import { CHILDREN_QUERY, type ChildrenQuery } from './ports/children.query.js';
import { CONSENT_REPOSITORY, type ConsentRepository } from './ports/consent.repository.js';
import type { AuthSession } from './ports/identity-provider.port.js';
import { MEMBERSHIPS_QUERY, type MembershipsQuery } from './ports/memberships.query.js';
import { PROFILE_QUERY, type ProfileQuery } from './ports/profile.query.js';

@Injectable()
export class GetCurrentUser {
  constructor(
    @Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository,
    @Inject(MEMBERSHIPS_QUERY) private readonly memberships: MembershipsQuery,
    @Inject(PROFILE_QUERY) private readonly profiles: ProfileQuery,
    @Inject(CHILDREN_QUERY) private readonly children: ChildrenQuery,
  ) {}

  async execute(session: AuthSession): Promise<MeResponse> {
    const { id, name, email, platformAdmin } = session.user;
    const [consent, memberships, profile, children] = await Promise.all([
      this.consents.findActive(id, POLICY_VERSION),
      this.memberships.listForUser(id),
      this.profiles.profileOf({ id, name }),
      this.children.childrenOf(id),
    ]);
    return {
      user: { id, name, email, platformAdmin },
      profile,
      consent: consent && {
        policyVersion: consent.policyVersion,
        acceptedAt: consent.acceptedAt.toISOString(),
      },
      ...memberships,
      children,
    };
  }
}
