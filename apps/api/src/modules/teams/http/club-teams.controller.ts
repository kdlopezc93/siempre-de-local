import { Body, Controller, Param, Post } from '@nestjs/common';
import { CreateTeamRequestSchema, type CreateTeamResponse } from '@sdl/contracts';
import { z } from 'zod';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { CreateTeam } from '../application/club-teams.use-cases.js';

/** Equipos de un club (2026-10-29): el dueño o un admin crea otro. */
@Controller('clubs/:clubId/teams')
export class ClubTeamsController {
  constructor(private readonly createTeam: CreateTeam) {}

  @Post()
  create(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Body() body: unknown,
  ): Promise<CreateTeamResponse> {
    return this.createTeam.execute(
      session.user.id,
      parseInput(z.uuid(), clubId),
      parseInput(CreateTeamRequestSchema, body),
    );
  }
}
