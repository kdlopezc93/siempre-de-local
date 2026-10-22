import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  type AcceptInvitationResponse,
  type CreateInvitationResponse,
  CreateInvitationRequestSchema,
  type InvitationListResponse,
  type InvitationPreviewResponse,
} from '@sdl/contracts';
import { z } from 'zod';

import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.js';
import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { Public } from '../../../shared/authz/public.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { InvitationRedemption, TeamInvitations } from '../application/invitations.use-cases.js';

const UUID = z.uuid();

@Controller('teams/:teamId/invitations')
export class TeamInvitationsController {
  constructor(
    private readonly invitations: TeamInvitations,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  @Can('team.players.invite', { teamParam: 'teamId' })
  async create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<CreateInvitationResponse> {
    const request = parseInput(CreateInvitationRequestSchema, body ?? {});
    const { invitation, code } = await this.invitations.create(actor, teamId, request);
    // El código solo viaja en esta respuesta; en la BD queda su hash.
    return { invitation, code, joinUrl: new URL(`/unirse/${code}`, this.env.WEB_ORIGIN).href };
  }

  @Get()
  @Can('team.players.invite', { teamParam: 'teamId' })
  async list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<InvitationListResponse> {
    return { items: await this.invitations.list(actor, teamId) };
  }

  @Delete(':invitationId')
  @HttpCode(204)
  @Can('team.players.invite', { teamParam: 'teamId' })
  async revoke(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.invitations.revoke(actor, teamId, parseInput(UUID, invitationId));
  }
}

/** 20 peticiones por minuto y por IP entre ver y aceptar (ThrottlerModule en TeamsModule). */
@Controller('invitations')
@UseGuards(ThrottlerGuard)
export class InvitationsController {
  constructor(private readonly redemption: InvitationRedemption) {}

  @Public()
  @Get(':code')
  preview(@Param('code') code: string): Promise<InvitationPreviewResponse> {
    return this.redemption.preview(code);
  }

  @Post(':code/accept')
  accept(
    @CurrentSession() session: AuthSession,
    @Param('code') code: string,
  ): Promise<AcceptInvitationResponse> {
    return this.redemption.accept(session.user.id, code);
  }
}
