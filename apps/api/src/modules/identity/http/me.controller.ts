import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  AcceptConsentRequestSchema,
  type AcceptConsentResponse,
  type MeResponse,
} from '@sdl/contracts';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import { AcceptConsent } from '../application/accept-consent.use-case.js';
import { GetCurrentUser } from '../application/get-current-user.use-case.js';
import type { AuthSession } from '../application/ports/identity-provider.port.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly getCurrentUser: GetCurrentUser,
    private readonly acceptConsent: AcceptConsent,
  ) {}

  @Get()
  me(@CurrentSession() session: AuthSession): Promise<MeResponse> {
    return this.getCurrentUser.execute(session);
  }

  @Post('consent')
  consent(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
  ): Promise<AcceptConsentResponse> {
    return this.acceptConsent.execute(
      session.user.id,
      parseInput(AcceptConsentRequestSchema, body),
    );
  }
}
