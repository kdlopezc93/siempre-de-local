/** Sesión validada, independiente del proveedor de identidad (ADR-07). */
export interface AuthSession {
  sessionId: string;
  expiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Puerto de identidad. El resto del sistema solo conoce el `userId` interno;
 * cambiar Google/Better Auth por otro proveedor es cambiar esta implementación.
 */
export interface IdentityProvider {
  getSession(headers: Headers): Promise<AuthSession | null>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
