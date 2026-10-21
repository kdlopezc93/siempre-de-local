import { Global, Module } from '@nestjs/common';

import { AUTHORIZATION_READER } from '../../shared/authz/actor.port.js';
import { GetTeam } from './application/get-team.use-case.js';
import { TEAMS_REPOSITORY } from './application/ports/teams.repository.js';
import { TeamsController } from './http/teams.controller.js';
import { DrizzleTeamsRepository } from './infrastructure/drizzle-teams.repository.js';

/** Global porque PermissionGuard (global) necesita leer membresías. */
@Global()
@Module({
  controllers: [TeamsController],
  providers: [
    DrizzleTeamsRepository,
    { provide: TEAMS_REPOSITORY, useExisting: DrizzleTeamsRepository },
    { provide: AUTHORIZATION_READER, useExisting: DrizzleTeamsRepository },
    GetTeam,
  ],
  exports: [AUTHORIZATION_READER],
})
export class TeamsModule {}
