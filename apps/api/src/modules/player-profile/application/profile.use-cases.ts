import { Inject, Injectable } from '@nestjs/common';
import type {
  PositionCode,
  PreferredPositionsRequest,
  Profile,
  UpdateProfileRequest,
} from '@sdl/contracts';

import { CONSENT_CHECKER, type ConsentChecker } from '../../../shared/consent/consent.port.js';
import { ForbiddenError } from '../../../shared/errors/application-errors.js';
import type { ProfileQuery } from '../../identity/application/ports/profile.query.js';
import type { ProfilesQuery } from '../../squad/application/ports/squad.ports.js';
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
  type StoredPreferences,
} from './ports/profile.repository.js';

type StoredProfile = { preferences: StoredPreferences | null; positions: PositionCode[] };

type User = { id: string; name: string };

/** Sin perfil guardado, el nombre visible es el de Google. */
function toProfile(user: User, stored: StoredProfile): Profile {
  return {
    displayName: stored.preferences?.displayName ?? user.name,
    dominantFoot: stored.preferences?.dominantFoot ?? null,
    playsGoalkeeper: stored.preferences?.playsGoalkeeper ?? false,
    preferredPositions: stored.positions,
  };
}

/** Perfil propio (02 §1): solo lo edita su dueño, con la política aceptada. */
@Injectable()
export class PlayerProfiles implements ProfileQuery, ProfilesQuery {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(CONSENT_CHECKER) private readonly consent: ConsentChecker,
  ) {}

  async profileOf(user: User): Promise<Profile> {
    return toProfile(user, await this.profiles.find(user.id));
  }

  async profilesOf(users: User[]): Promise<Map<string, Profile>> {
    const stored = await this.profiles.findMany(users.map((u) => u.id));
    return new Map(users.map((u) => [u.id, toProfile(u, stored.get(u.id)!)]));
  }

  async update(user: User, patch: UpdateProfileRequest): Promise<Profile> {
    await this.requireConsent(user.id);
    const current = await this.profileOf(user);
    await this.profiles.savePreferences(user.id, {
      displayName: patch.displayName ?? current.displayName,
      dominantFoot: patch.dominantFoot === undefined ? current.dominantFoot : patch.dominantFoot,
      playsGoalkeeper: patch.playsGoalkeeper ?? current.playsGoalkeeper,
    });
    return this.profileOf(user);
  }

  async setPreferredPositions(user: User, request: PreferredPositionsRequest): Promise<Profile> {
    await this.requireConsent(user.id);
    await this.profiles.replacePositions(user.id, request.positions);
    return this.profileOf(user);
  }

  private async requireConsent(userId: string) {
    if (!(await this.consent.hasCurrentConsent(userId))) {
      throw new ForbiddenError('Antes de seguir acepta la política de datos.', 'CONSENT_REQUIRED');
    }
  }
}
