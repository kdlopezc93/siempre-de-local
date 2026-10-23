import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { TeamResponse } from '@sdl/contracts';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import { cleanPhoto } from '../../../shared/photos/clean-photo.js';
import { PHOTO_STORAGE, type PhotoStorage } from '../../../shared/photos/photo-storage.port.js';
import { TEAMS_REPOSITORY, type TeamsRepository } from './ports/teams.repository.js';

/** Escudo o foto del equipo (07 §4.7): la ponen el coach o el admin del club; la ve el equipo. */
@Injectable()
export class TeamPhotos {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async set(actor: Actor, teamId: string, upload: Buffer): Promise<TeamResponse> {
    await this.authorize(actor, teamId, 'team.settings.write');
    const photo = cleanPhoto(upload);
    if (!photo) {
      throw new BusinessRuleError(
        'La foto tiene que ser WebP o JPEG de hasta 512 KB.',
        'PHOTO_INVALID',
      );
    }
    const previous = await this.teams.photoKey(teamId);
    const key = `teams/${teamId}/${randomUUID()}.${photo.extension}`;
    await this.storage.put(key, photo.bytes, photo.contentType);
    await this.teams.setPhotoKey(teamId, key);
    if (previous) await this.storage.delete(previous);
    await this.record(actor, teamId, 'team.photo_updated');
    return this.response(actor, teamId);
  }

  async remove(actor: Actor, teamId: string): Promise<TeamResponse> {
    await this.authorize(actor, teamId, 'team.settings.write');
    const previous = await this.teams.photoKey(teamId);
    if (previous) {
      await this.teams.setPhotoKey(teamId, null);
      await this.storage.delete(previous);
      await this.record(actor, teamId, 'team.photo_removed');
    }
    return this.response(actor, teamId);
  }

  async read(actor: Actor, teamId: string) {
    await this.authorize(actor, teamId, 'team.read');
    const key = await this.teams.photoKey(teamId);
    const photo = key ? await this.storage.get(key) : null;
    if (!photo) throw new NotFoundError('Foto no encontrada', 'PHOTO_NOT_FOUND');
    return photo;
  }

  private async authorize(
    actor: Actor,
    teamId: string,
    permission: 'team.read' | 'team.settings.write',
  ) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, permission, { teamId, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
  }

  private async response(actor: Actor, teamId: string): Promise<TeamResponse> {
    const team = (await this.teams.findById(teamId))!;
    return { team, myRoles: [...(actor.teams.get(teamId) ?? [])] };
  }

  private record(actor: Actor, teamId: string, action: string) {
    return this.audit.record({
      actorUserId: actor.userId,
      action,
      entity: 'team',
      entityId: teamId,
      teamId,
      meta: {},
    });
  }
}
