import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { clientIp } from './client-ip.js';

/** El límite de intentos por IP, con la IP real del cliente (`clientIp`), no la que él diga. */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    return Promise.resolve(
      clientIp(request as { headers: Record<string, string | undefined>; ip: string }),
    );
  }
}
