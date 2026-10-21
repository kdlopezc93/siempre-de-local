import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import type { Env } from '../../../config/env.js';
import type { Database } from '../../../shared/db/client.js';
import * as schema from './schema.js';

const DAY_S = 60 * 60 * 24;

/** Único punto del sistema que configura Better Auth (ADR-04, ADR-07). */
export function createAuth(env: Env, db: Database) {
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
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      database: { generateId: false },
      // Better Auth apaga el chequeo de origen y callbackURL si detecta un entorno de test;
      // lo fijamos para que los tests verifiquen lo mismo que corre en producción.
      disableOriginCheck: false,
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
