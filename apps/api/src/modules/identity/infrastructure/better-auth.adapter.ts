import type { AuthSession, IdentityProvider } from '../application/ports/identity-provider.port.js';
import type { Auth } from './better-auth.js';

export class BetterAuthIdentityProvider implements IdentityProvider {
  constructor(private readonly auth: Auth) {}

  async getSession(headers: Headers): Promise<AuthSession | null> {
    const result = await this.auth.api.getSession({ headers });
    if (!result) return null;
    return {
      sessionId: result.session.id,
      expiresAt: result.session.expiresAt,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        platformAdmin: result.user.platformAdmin === true,
      },
    };
  }
}
