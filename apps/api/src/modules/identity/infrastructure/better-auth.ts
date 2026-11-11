import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';

import type { Env } from '../../../config/env.js';
import type { Database } from '../../../shared/db/client.js';
import * as schema from './schema.js';

const DAY_S = 60 * 60 * 24;

/** Lo que otros módulos hacen cuando cambia una sesión, sin importar Better Auth. */
export interface SessionEvents {
  /** "Cerrar todas las sesiones": la persona dejó de confiar en sus otros dispositivos. */
  sessionsRevoked?: (userId: string) => Promise<void>;
}

/** Único punto del sistema que configura Better Auth (ADR-04, ADR-07). */
export function createAuth(env: Env, db: Database, events: SessionEvents = {}) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Scopes por defecto: openid email profile. No se pide nada más (04 §1).
        prompt: 'select_account',
      },
    },
    user: {
      additionalFields: {
        platformAdmin: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    session: {
      expiresIn: 30 * DAY_S,
      updateAge: DAY_S,
    },
    advanced: {
      cookiePrefix: 'sdl',
      useSecureCookies: env.BETTER_AUTH_URL.startsWith('https://'),
      crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN },
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
      // La IP para sus límites de intentos (auditoría 2026-11-10, M1): la que pone Fly, que el
      // cliente no puede falsear; `X-Forwarded-For` solo sirve con una sola IP (local).
      ipAddress: { ipAddressHeaders: ['fly-client-ip', 'x-forwarded-for'] },
      database: { generateId: false },
      // Better Auth apaga el chequeo de origen y callbackURL si detecta un entorno de test;
      // lo fijamos para que los tests verifiquen lo mismo que corre en producción.
      disableOriginCheck: false,
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/revoke-sessions') return;
        const userId = ctx.context.session?.user.id;
        if (userId) await events.sessionsRevoked?.(userId);
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Solo cuentas con email verificado por Google; sin foto de perfil (04 §1 y §5).
          before: async (user) => {
            if (!user.emailVerified) return false;
            return { data: { ...user, image: null } };
          },
        },
        update: {
          before: async (user) => ({ data: { ...user, image: null } }),
        },
      },
      account: {
        // Los tokens de Google no se usan después del login: no se guardan.
        create: {
          before: async (account) => ({
            data: { ...account, accessToken: null, refreshToken: null, idToken: null },
          }),
        },
        update: {
          before: async (account) => ({
            data: { ...account, accessToken: null, refreshToken: null, idToken: null },
          }),
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
