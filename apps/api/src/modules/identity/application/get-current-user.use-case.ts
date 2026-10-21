import { Injectable } from '@nestjs/common';
import type { MeResponse } from '@sdl/contracts';

import type { AuthSession } from './ports/identity-provider.port.js';

@Injectable()
export class GetCurrentUser {
  execute(session: AuthSession): MeResponse {
    const { id, name, email } = session.user;
    return { user: { id, name, email } };
  }
}
