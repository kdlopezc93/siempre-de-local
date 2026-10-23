import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Put,
  StreamableFile,
} from '@nestjs/common';
import {
  type TeamResponse,
  UpdateMemberRequestSchema,
  UpdateTeamRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { photoBody } from '../../../shared/photos/photo-body.js';
import { GetTeam, UpdateMember, UpdateTeam } from '../application/get-team.use-case.js';
import { TeamPhotos } from '../application/team-photo.use-cases.js';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly getTeam: GetTeam,
    private readonly updateTeam: UpdateTeam,
    private readonly updateMember: UpdateMember,
    private readonly photos: TeamPhotos,
  ) {}

  @Get(':teamId')
  @Can('team.read', { teamParam: 'teamId' })
  findOne(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<TeamResponse> {
    return this.getTeam.execute(actor, teamId);
  }

  @Patch(':teamId')
  @Can('team.settings.write', { teamParam: 'teamId' })
  update(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<TeamResponse> {
    return this.updateTeam.execute(actor, teamId, parseInput(UpdateTeamRequestSchema, body));
  }

  @Patch(':teamId/members/:userId')
  @Can('team.members.manage', { teamParam: 'teamId' })
  @HttpCode(204)
  async member(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.updateMember.execute(
      actor,
      teamId,
      parseInput(z.uuid(), userId),
      parseInput(UpdateMemberRequestSchema, body),
    );
  }

  /** Escudo o foto: bytes WebP o JPEG, ya recortados en el celular (ADR-09). */
  @Put(':teamId/photo')
  @Can('team.settings.write', { teamParam: 'teamId' })
  setPhoto(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<TeamResponse> {
    return this.photos.set(actor, teamId, photoBody(body));
  }

  @Delete(':teamId/photo')
  @Can('team.settings.write', { teamParam: 'teamId' })
  removePhoto(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<TeamResponse> {
    return this.photos.remove(actor, teamId);
  }

  @Get(':teamId/photo')
  @Can('team.read', { teamParam: 'teamId' })
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  async photo(@CurrentActor() actor: Actor, @Param('teamId') teamId: string) {
    const photo = await this.photos.read(actor, teamId);
    return new StreamableFile(photo.bytes, { type: photo.contentType });
  }
}
