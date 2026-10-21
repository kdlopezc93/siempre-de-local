import { MeResponseSchema, type MeResponse } from '@sdl/contracts';
import { z } from 'zod';

import { ApiError, apiFetch, apiRequest } from './http';

/**
 * Cliente de identidad. Habla con /api/auth/* (Better Auth) por HTTP, sin importar
 * su SDK: la web tampoco depende del proveedor de identidad (ADR-07).
 */

const SocialSignInSchema = z.object({ url: z.url() });

export type Me = MeResponse;
export type CurrentUser = MeResponse['user'];

/** La persona de la sesión con su consentimiento y equipos, o null si no hay sesión. */
export async function fetchMe(): Promise<Me | null> {
  try {
    return await apiRequest('/api/v1/me', MeResponseSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/**
 * Inicia el login con Google y devuelve la URL de Google a la que hay que ir.
 * Al volver, Google deja a la persona en `returnTo` (p. ej. su enlace de invitación).
 */
export async function startGoogleSignIn(returnTo = '/'): Promise<string> {
  const origin = window.location.origin;
  const errorPath = returnTo === '/' ? '/entrar' : returnTo;
  const { url } = await apiRequest('/api/auth/sign-in/social', SocialSignInSchema, {
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      callbackURL: `${origin}${returnTo}`,
      errorCallbackURL: `${origin}${errorPath}?error=google`,
    }),
  });
  return url;
}

export async function signOut(): Promise<void> {
  await apiFetch('/api/auth/sign-out', { method: 'POST', body: '{}' });
}

/** Cierra todas las sesiones del usuario, incluida la de este dispositivo. */
export async function signOutEverywhere(): Promise<void> {
  await apiFetch('/api/auth/revoke-sessions', { method: 'POST', body: '{}' });
  // La cookie de este dispositivo ya no vale; se borra igual por limpieza.
  await signOut().catch(() => undefined);
}
