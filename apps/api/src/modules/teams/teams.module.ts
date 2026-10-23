import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { AUTHORIZATION_READER } from '../../shared/authz/actor.port.js';
import { MEMBERSHIPS_QUERY } from '../identity/application/ports/memberships.query.js';
import { TEAM_PLAYERS_QUERY } from '../squad/application/ports/squad.ports.js';
import { GetTeam, UpdateMember, UpdateTeam } from './application/get-team.use-case.js';
import { TeamPhotos } from './application/team-photo.use-cases.js';
import { InvitationRedemption, TeamInvitations } from './application/invitations.use-cases.js';
import { INVITATIONS_REPOSITORY } from './application/ports/invitations.repository.js';
import { TEAMS_REPOSITORY } from './application/ports/teams.repository.js';
import { InvitationsController, TeamInvitationsController } from './http/invitations.controller.js';
import { TeamsController } from './http/teams.controller.js';
import { DrizzleInvitationsRepository } from './infrastructure/drizzle-invitations.repository.js';
import { DrizzleTeamsRepository } from './infrastructure/drizzle-teams.repository.js';

/** Global porque PermissionGuard (global) e identity (`/me`) leen membresías. */
@Global()
@Module({
  imports: [
    // Endpoints públicos de invitación: ver y aceptar un código. Corta la fuerza bruta
    // sobre los códigos (04 §1.2). En memoria: alcanza con una sola instancia del API.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
      errorMessage: 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.',
    }),
  ],
  controllers: [TeamsController, TeamInvitationsController, InvitationsController],
  providers: [
    DrizzleTeamsRepository,
    { provide: TEAMS_REPOSITORY, useExisting: DrizzleTeamsRepository },
    { provide: AUTHORIZATION_READER, useExisting: DrizzleTeamsRepository },
    { provide: MEMBERSHIPS_QUERY, useExisting: DrizzleTeamsRepository },
    { provide: TEAM_PLAYERS_QUERY, useExisting: DrizzleTeamsRepository },
    { provide: INVITATIONS_REPOSITORY, useClass: DrizzleInvitationsRepository },
    GetTeam,
    TeamPhotos,
    UpdateTeam,
    UpdateMember,
    TeamInvitations,
    InvitationRedemption,
  ],
  exports: [AUTHORIZATION_READER, MEMBERSHIPS_QUERY, TEAMS_REPOSITORY, TEAM_PLAYERS_QUERY],
})
export class TeamsModule {}
