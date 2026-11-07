import { Inject, Injectable } from '@nestjs/common';
import type {
  AddClubAdminRequest,
  ClubResponse,
  CreateVenueRequestSchema,
  UpdateVenueRequestSchema,
  CreateTeamRequestSchema,
  CreateTeamResponse,
  UpdateClubRequest,
  UpdateClubTeamRequest,
} from '@sdl/contracts';
import type { z } from 'zod';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import { TEAMS_REPOSITORY, type TeamsRepository } from './ports/teams.repository.js';
import { assertCategory, assertSchool, assertVenueOfClub, teamsLimit } from './school-rules.js';

/** El club, o 404. */
async function clubOrThrow(teams: TeamsRepository, clubId: string) {
  const club = await teams.findClub(clubId);
  if (!club) throw new NotFoundError('Club no encontrado');
  return club;
}

/**
 * Otro equipo del club (Kevin, 2026-10-29): lo crea el dueño o un admin del club y queda de
 * entrenador. Si lo va a entrenar otra persona, la invita como entrenador desde ese equipo y al
 * aceptar se pasa el mando (#124); así nunca queda un equipo sin nadie que lo maneje.
 */
@Injectable()
export class CreateTeam {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(
    userId: string,
    clubId: string,
    request: z.output<typeof CreateTeamRequestSchema>,
    now = new Date(),
  ): Promise<CreateTeamResponse> {
    const mine = await this.memberships.loadMemberships(userId);
    if (!mine.clubs.has(clubId)) {
      throw new ForbiddenError('Solo el dueño y los admins del club crean equipos');
    }
    const club = await clubOrThrow(this.teams, clubId);
    // En una escuela, la categoría nace con sus años y su género; sedes, solo en escuelas (2026-11-07).
    assertCategory(club.kind, request);
    if (request.venueId) {
      assertSchool(club.kind);
      await assertVenueOfClub(this.teams, clubId, request.venueId);
    }
    const limit = teamsLimit(club.kind);
    const outcome = await this.teams.createTeam(
      clubId,
      userId,
      {
        name: request.name,
        category: request.category || null,
        format: request.format,
        season: request.season,
        alsoPlays: request.alsoPlays,
        birthYears: request.birthYears ?? null,
        gender: request.gender ?? null,
        venueId: request.venueId ?? null,
      },
      limit,
      now,
    );
    const school = club.kind === 'school';
    if (outcome === 'limit') {
      throw new ConflictError(
        school
          ? `La escuela ya tiene ${limit} categorías. Para abrir otra, escríbenos.`
          : `El club ya tiene ${limit} equipos. Para abrir otro, escríbenos.`,
        'TEAM_LIMIT_REACHED',
      );
    }
    if (outcome === 'name-taken') {
      throw new ConflictError(
        school
          ? 'Ya hay otra categoría con ese nombre en la escuela esta temporada'
          : 'Ya hay otro equipo con ese nombre en el club esta temporada',
        'TEAM_NAME_TAKEN',
      );
    }
    await this.audit.record({
      actorUserId: userId,
      action: 'team.created',
      entity: 'team',
      entityId: outcome.teamId,
      teamId: outcome.teamId,
      meta: { clubId },
    });
    return outcome;
  }
}

/** El rol de quien pide en el club, o 403: el club lo manejan su dueño y sus admins. */
async function clubRoleOf(memberships: AuthorizationReader, userId: string, clubId: string) {
  const role = (await memberships.loadMemberships(userId)).clubs.get(clubId);
  if (!role) throw new ForbiddenError('Solo el dueño y los admins del club lo manejan');
  return role;
}

/** La pantalla del club (2026-10-29): sus datos y sus equipos. */
@Injectable()
export class GetClub {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
  ) {}

  async execute(userId: string, clubId: string): Promise<ClubResponse> {
    const myRole = await clubRoleOf(this.memberships, userId, clubId);
    const club = await clubOrThrow(this.teams, clubId);
    const [teams, admins, candidates, venues] = await Promise.all([
      this.teams.clubTeams(clubId),
      this.teams.clubAdmins(clubId),
      this.teams.clubCandidates(clubId),
      this.teams.clubVenues(clubId),
    ]);
    return { club, myRole, teamsLimit: teamsLimit(club.kind), teams, admins, candidates, venues };
  }
}

/** Nombre y ciudad o barrio del club (dueño o admin, 2026-10-29). El slug no cambia. */
@Injectable()
export class UpdateClub {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(userId: string, clubId: string, patch: UpdateClubRequest): Promise<ClubResponse> {
    await clubRoleOf(this.memberships, userId, clubId);
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<{ name: string; city: string }>;
    await this.teams.updateClub(clubId, changes);
    await this.audit.record({
      actorUserId: userId,
      action: 'club.updated',
      entity: 'club',
      entityId: clubId,
      meta: { ...changes },
    });
    return new GetClub(this.teams, this.memberships).execute(userId, clubId);
  }
}

/**
 * Archivar un equipo que ya no juega, o desarchivarlo (Kevin, 2026-10-29). Archivado, sus
 * integrantes dejan de verlo y de tener acceso, y sus invitaciones no sirven; libera un cupo.
 */
@Injectable()
export class ArchiveTeam {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(
    userId: string,
    clubId: string,
    teamId: string,
    { archived }: UpdateClubTeamRequest,
    now = new Date(),
  ): Promise<ClubResponse> {
    await clubRoleOf(this.memberships, userId, clubId);
    const club = await clubOrThrow(this.teams, clubId);
    const limit = teamsLimit(club.kind);
    const outcome = await this.teams.setArchived(clubId, teamId, archived, limit, now);
    if (outcome === 'not-found') throw new NotFoundError('Ese equipo no es del club');
    if (outcome === 'limit') {
      throw new ConflictError(
        club.kind === 'school'
          ? `La escuela ya tiene ${limit} categorías activas. Archiva otra antes de volver a abrir esta.`
          : `El club ya tiene ${limit} equipos activos. Archiva otro antes de volver a abrir este.`,
        'TEAM_LIMIT_REACHED',
      );
    }
    await this.audit.record({
      actorUserId: userId,
      action: archived ? 'team.archived' : 'team.unarchived',
      entity: 'team',
      entityId: teamId,
      teamId,
      meta: { clubId },
    });
    return new GetClub(this.teams, this.memberships).execute(userId, clubId);
  }
}

/**
 * Admins del club (Kevin, 2026-10-29): el dueño los nombra entre los integrantes de sus equipos
 * activos y los quita. Al dueño no se le quita. Un admin ve todos los equipos del club, invita
 * entrenadores, crea y archiva equipos y edita el club (04 §2.2).
 */
@Injectable()
export class ClubAdmins {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async add(userId: string, clubId: string, { userId: target }: AddClubAdminRequest) {
    await this.assertOwner(userId, clubId);
    const candidates = await this.teams.clubCandidates(clubId);
    if (!candidates.some((c) => c.userId === target)) {
      throw new BusinessRuleError(
        'Solo puedes nombrar admin a alguien de los equipos del club que todavía no lo sea',
        'NOT_A_CLUB_CANDIDATE',
      );
    }
    await this.teams.addClubAdmin(clubId, target);
    await this.record(userId, clubId, target, 'club.admin_added');
    return new GetClub(this.teams, this.memberships).execute(userId, clubId);
  }

  async remove(userId: string, clubId: string, target: string) {
    await this.assertOwner(userId, clubId);
    if (!(await this.teams.removeClubAdmin(clubId, target))) {
      throw new NotFoundError('Esa persona no es admin del club', 'NOT_A_CLUB_ADMIN');
    }
    await this.record(userId, clubId, target, 'club.admin_removed');
    return new GetClub(this.teams, this.memberships).execute(userId, clubId);
  }

  private async assertOwner(userId: string, clubId: string) {
    if ((await clubRoleOf(this.memberships, userId, clubId)) !== 'owner') {
      throw new ForbiddenError('Solo el dueño del club nombra o quita admins');
    }
  }

  private record(userId: string, clubId: string, target: string, action: string) {
    return this.audit.record({
      actorUserId: userId,
      action,
      entity: 'club_membership',
      entityId: target,
      meta: { clubId },
    });
  }
}

/**
 * Sedes de la escuela (2026-11-07): las crean, cambian y borran el dueño y los admins. Borrar
 * una deja a sus categorías sin sede. Devuelven el club.
 */
@Injectable()
export class ClubVenues {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async create(
    userId: string,
    clubId: string,
    request: z.output<typeof CreateVenueRequestSchema>,
  ): Promise<ClubResponse> {
    await this.assertSchoolAdmin(userId, clubId);
    const created = await this.teams.createVenue(clubId, {
      name: request.name,
      address: request.address ?? null,
    });
    if (created === 'name-taken') throw venueNameTaken();
    await this.record(userId, clubId, created.id, 'venue.created');
    return this.club(userId, clubId);
  }

  async update(
    userId: string,
    clubId: string,
    venueId: string,
    patch: z.output<typeof UpdateVenueRequestSchema>,
  ): Promise<ClubResponse> {
    await this.assertSchoolAdmin(userId, clubId);
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<{ name: string; address: string | null }>;
    const outcome = await this.teams.updateVenue(clubId, venueId, changes);
    if (outcome === 'not-found') {
      throw new NotFoundError('Esa sede no es de la escuela', 'VENUE_NOT_FOUND');
    }
    if (outcome === 'name-taken') throw venueNameTaken();
    await this.record(userId, clubId, venueId, 'venue.updated');
    return this.club(userId, clubId);
  }

  async remove(userId: string, clubId: string, venueId: string): Promise<ClubResponse> {
    await this.assertSchoolAdmin(userId, clubId);
    if (!(await this.teams.deleteVenue(clubId, venueId))) {
      throw new NotFoundError('Esa sede no es de la escuela', 'VENUE_NOT_FOUND');
    }
    await this.record(userId, clubId, venueId, 'venue.deleted');
    return this.club(userId, clubId);
  }

  private async assertSchoolAdmin(userId: string, clubId: string) {
    await clubRoleOf(this.memberships, userId, clubId);
    assertSchool((await clubOrThrow(this.teams, clubId)).kind);
  }

  private club(userId: string, clubId: string) {
    return new GetClub(this.teams, this.memberships).execute(userId, clubId);
  }

  private record(userId: string, clubId: string, venueId: string, action: string) {
    return this.audit.record({
      actorUserId: userId,
      action,
      entity: 'venue',
      entityId: venueId,
      meta: { clubId },
    });
  }
}

function venueNameTaken(): ConflictError {
  return new ConflictError('Ya hay otra sede con ese nombre en la escuela', 'VENUE_NAME_TAKEN');
}
