import { Controller, Get } from '@nestjs/common';
import type { MeResponse } from '@sdl/contracts';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { GetCurrentUser } from '../application/get-current-user.use-case.js';
import type { AuthSession } from '../application/ports/identity-provider.port.js';

@Controller('me')
export class MeController {
  constructor(private readonly getCurrentUser: GetCurrentUser) {}

  @Get()
  me(@CurrentSession() session: AuthSession): MeResponse {
    return this.getCurrentUser.execute(session);
  }
}
