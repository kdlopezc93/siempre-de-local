import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  AddClubAdminRequestSchema,
  type ClubResponse,
  CreateTeamRequestSchema,
  type CreateTeamResponse,
  CreateVenueRequestSchema,
  UpdateClubRequestSchema,
  UpdateClubTeamRequestSchema,
  UpdateVenueRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import {
  ArchiveTeam,
  ClubAdmins,
  ClubVenues,
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
    private readonly admins: ClubAdmins,
    private readonly venues: ClubVenues,
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

  @Post('admins')
  addAdmin(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Body() body: unknown,
  ): Promise<ClubResponse> {
    return this.admins.add(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(AddClubAdminRequestSchema, body),
    );
  }

  @Delete('admins/:userId')
  removeAdmin(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Param('userId') userId: string,
  ): Promise<ClubResponse> {
    return this.admins.remove(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(z.uuid(), userId),
    );
  }

  /** Sedes de la escuela (2026-11-07). */
  @Post('venues')
  createVenue(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Body() body: unknown,
  ): Promise<ClubResponse> {
    return this.venues.create(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(CreateVenueRequestSchema, body),
    );
  }

  @Patch('venues/:venueId')
  updateVenue(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Param('venueId') venueId: string,
    @Body() body: unknown,
  ): Promise<ClubResponse> {
    return this.venues.update(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(z.uuid(), venueId),
      parseInput(UpdateVenueRequestSchema, body),
    );
  }

  @Delete('venues/:venueId')
  removeVenue(
    @CurrentSession() session: AuthSession,
    @Param('clubId') clubId: string,
    @Param('venueId') venueId: string,
  ): Promise<ClubResponse> {
    return this.venues.remove(
      session.user.id,
      parseInput(ClubId, clubId),
      parseInput(z.uuid(), venueId),
    );
  }
}
