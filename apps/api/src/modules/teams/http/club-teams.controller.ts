import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  type ClubResponse,
  CreateTeamRequestSchema,
  type CreateTeamResponse,
  UpdateClubRequestSchema,
  UpdateClubTeamRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import {
  ArchiveTeam,
  CreateTeam,
  GetClub,
  UpdateClub,
} from '../application/club-teams.use-cases.js';

const ClubId = z.uuid();

/** El club (2026-10-29): sus datos y sus equipos, para el dueño y los admins. */
@Controller('clubs/:clubId')
export class ClubTeamsController {
  constructor(
    private readonly getClub: GetClub,
    private readonly updateClub: UpdateClub,
    private readonly createTeam: CreateTeam,
    private readonly archiveTeam: ArchiveTeam,
  ) {}

  @Get()
  find(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
  ): Promise<ClubResponse> {
    return this.getClub.execute(session.user.id, parseInput(ClubId, clubId));
  }

  @Patch()
  update(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Body() body: unknown,
  ): Promise<ClubResponse> {
    return this.updateClub.execute(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(UpdateClubRequestSchema, body),
    );
  }

  @Post('teams')
  create(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Body() body: unknown,
  ): Promise<CreateTeamResponse> {
    return this.createTeam.execute(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(CreateTeamRequestSchema, body),
    );
  }

  @Patch('teams/:teamId')
  archive(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<ClubResponse> {
    return this.archiveTeam.execute(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(z.uuid(), teamId),
      parseInput(UpdateClubTeamRequestSchema, body),
    );
  }
}
