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
  type ClubCodeListResponse,
  type ClubCodePreviewResponse,
  CreateClubCodeRequestSchema,
  type CreateClubCodeResponse,
  CreateClubRequestSchema,
  type CreateClubResponse,
} from '@sdl/contracts';
import { z } from 'zod';

import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.js';
import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { Public } from '../../../shared/authz/public.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { ClubCodes, CreateClub } from '../application/club-codes.use-cases.js';

const actorOf = (session: AuthSession) => ({
  userId: session.user.id,
  platformAdmin: session.user.platformAdmin,
});

/** Códigos de alta de clubes: solo el administrador de la plataforma (2026-10-29). */
@Controller('admin/club-codes')
export class ClubCodesController {
  constructor(
    private readonly codes: ClubCodes,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  async create(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<CreateClubCodeResponse> {
    const request = parseInput(CreateClubCodeRequestSchema, body ?? {});
    const { clubCode, code } = await this.codes.create(actorOf(session), request);
    // El código solo viaja en esta respuesta; en la BD queda su hash.
    return { clubCode, code, url: new URL(`/crear-club/${code}`, this.env.WEB_ORIGIN).href };
  }

  @Get()
  async list(@CurrentSession() session: AuthSession): Promise<ClubCodeListResponse> {
    return { items: await this.codes.list(actorOf(session)) };
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentSession() session: AuthSession, @Param('id') id: string): Promise<void> {
    await this.codes.revoke(actorOf(session), parseInput(z.uuid(), id));
  }
}

/** Ver si un código de alta sirve y crear el club con él; 20 por minuto y por IP. */
@Controller()
@UseGuards(ThrottlerGuard)
export class CreateClubController {
  constructor(private readonly createClub: CreateClub) {}

  @Public()
  @Get('club-codes/:code')
  preview(@Param('code') code: string): Promise<ClubCodePreviewResponse> {
    return this.createClub.preview(code);
  }

  @Post('clubs')
  create(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<CreateClubResponse> {
    return this.createClub.execute(session.user.id, parseInput(CreateClubRequestSchema, body));
  }
}
