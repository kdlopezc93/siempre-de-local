import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RegisterMinorRequestSchema, type RegisterMinorResponse } from '@sdl/contracts';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { RegisterMinor } from '../application/register-minor.use-case.js';

/** Inscribir a un hijo con una invitación para acudientes (2026-11-08). Mismo límite por IP. */
@Controller('invitations')
@UseGuards(ThrottlerGuard)
export class FamiliesController {
  constructor(private readonly registerMinor: RegisterMinor) {}

  @Post(':code/minors')
  register(
    @CurrentSession() session: AuthSession,
    @Param('code') code: string,
    @Body() body: unknown,
  ): Promise<RegisterMinorResponse> {
    return this.registerMinor.execute(
      session.user.id,
      code,
      parseInput(RegisterMinorRequestSchema, body),
    );
  }
}
