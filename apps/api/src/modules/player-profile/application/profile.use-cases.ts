import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { PreferredPositionsRequest, Profile, UpdateProfileRequest } from '@sdl/contracts';

import { CONSENT_CHECKER, type ConsentChecker } from '../../../shared/consent/consent.port.js';
import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import { cleanPhoto } from '../../../shared/photos/clean-photo.js';
import { PHOTO_STORAGE, type PhotoStorage } from '../../../shared/photos/photo-storage.port.js';
import { photoUrl } from '../../../shared/photos/photo-url.js';
import type { ProfileQuery } from '../../identity/application/ports/profile.query.js';
import type { ProfilesQuery } from '../../squad/application/ports/squad.ports.js';
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
  type StoredProfile,
} from './ports/profile.repository.js';

type User = { id: string; name: string };

/** Sin perfil guardado, el nombre visible es el de Google. */
function toProfile(user: User, stored: StoredProfile): Profile {
  return {
    displayName: stored.preferences?.displayName ?? user.name,
    dominantFoot: stored.preferences?.dominantFoot ?? null,
    playsGoalkeeper: stored.preferences?.playsGoalkeeper ?? false,
    preferredPositions: stored.positions,
    photoUrl: photoUrl(`players/${user.id}/photo`, stored.photoKey),
  };
}

/** Perfil propio (02 §1): solo lo edita su dueño, con la política aceptada. */
@Injectable()
export class PlayerProfiles implements ProfileQuery, ProfilesQuery {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(CONSENT_CHECKER) private readonly consent: ConsentChecker,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
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

  /** Sube (o reemplaza) su foto: limpia, la guarda con clave nueva y borra la anterior. */
  async setPhoto(user: User, upload: Buffer): Promise<Profile> {
    await this.requireConsent(user.id);
    const photo = cleanPhoto(upload);
    if (!photo) {
      throw new BusinessRuleError(
        'La foto tiene que ser WebP o JPEG de hasta 512 KB.',
        'PHOTO_INVALID',
      );
    }
    const previous = (await this.profiles.find(user.id)).photoKey;
    const key = `players/${user.id}/${randomUUID()}.${photo.extension}`;
    await this.storage.put(key, photo.bytes, photo.contentType);
    await this.profiles.setPhotoKey(user.id, key, user.name);
    if (previous) await this.storage.delete(previous);
    return this.profileOf(user);
  }

  async removePhoto(user: User): Promise<Profile> {
    const previous = (await this.profiles.find(user.id)).photoKey;
    if (previous) {
      await this.profiles.setPhotoKey(user.id, null, user.name);
      await this.storage.delete(previous);
    }
    return this.profileOf(user);
  }

  /**
   * La foto de un jugador: la ve él, quien comparte un equipo activo con él y quien administra
   * el club de alguno de sus equipos. A los demás, 404 (no se confirma que exista).
   */
  async readPhoto(viewerId: string, userId: string) {
    if (viewerId !== userId && !(await this.sharesTeam(viewerId, userId))) {
      throw new NotFoundError('Foto no encontrada', 'PHOTO_NOT_FOUND');
    }
    const key = (await this.profiles.find(userId)).photoKey;
    const photo = key ? await this.storage.get(key) : null;
    if (!photo) throw new NotFoundError('Foto no encontrada', 'PHOTO_NOT_FOUND');
    return photo;
  }

  private async sharesTeam(viewerId: string, userId: string): Promise<boolean> {
    const [actor, theirs] = await Promise.all([
      this.memberships.loadMemberships(viewerId),
      this.memberships.loadMemberships(userId),
    ]);
    for (const teamId of theirs.teams.keys()) {
      if (actor.teams.has(teamId)) return true;
      const clubId = await this.memberships.findTeamClubId(teamId);
      if (clubId && actor.clubs.has(clubId)) return true;
    }
    return false;
  }

  private async requireConsent(userId: string) {
    if (!(await this.consent.hasCurrentConsent(userId))) {
      throw new ForbiddenError('Antes de seguir acepta la política de datos.', 'CONSENT_REQUIRED');
    }
  }
}
