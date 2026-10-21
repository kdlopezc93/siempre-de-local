import { Global, Module } from '@nestjs/common';

import { AUTHORIZATION_READER } from '../../shared/authz/actor.port.js';
import { GetTeam } from './application/get-team.use-case.js';
import { InvitationRedemption, TeamInvitations } from './application/invitations.use-cases.js';
import { INVITATIONS_REPOSITORY } from './application/ports/invitations.repository.js';
import { TEAMS_REPOSITORY } from './application/ports/teams.repository.js';
import { InvitationsController, TeamInvitationsController } from './http/invitations.controller.js';
import { TeamsController } from './http/teams.controller.js';
import { DrizzleInvitationsRepository } from './infrastructure/drizzle-invitations.repository.js';
import { DrizzleTeamsRepository } from './infrastructure/drizzle-teams.repository.js';

/** Global porque PermissionGuard (global) necesita leer membresías. */
@Global()
@Module({
  controllers: [TeamsController, TeamInvitationsController, InvitationsController],
  providers: [
    DrizzleTeamsRepository,
    { provide: TEAMS_REPOSITORY, useExisting: DrizzleTeamsRepository },
    { provide: AUTHORIZATION_READER, useExisting: DrizzleTeamsRepository },
    { provide: INVITATIONS_REPOSITORY, useClass: DrizzleInvitationsRepository },
    GetTeam,
    TeamInvitations,
    InvitationRedemption,
  ],
  exports: [AUTHORIZATION_READER],
})
export class TeamsModule {}
