import { MeResponseSchema, type MeResponse } from '@sdl/contracts';
import { z } from 'zod';

import { ApiError, apiFetch, apiRequest } from './http';

/**
 * Cliente de identidad. Habla con /api/auth/* (Better Auth) por HTTP, sin importar
 * su SDK: la web tampoco depende del proveedor de identidad (ADR-07).
 */

const SocialSignInSchema = z.object({ url: z.url() });

export type CurrentUser = MeResponse['user'];

/** Usuario de la sesión actual, o null si no hay sesión. */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const me = await apiRequest('/api/v1/me', MeResponseSchema);
    return me.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Inicia el login con Google y devuelve la URL de Google a la que hay que ir. */
export async function startGoogleSignIn(): Promise<string> {
  const origin = window.location.origin;
  const { url } = await apiRequest('/api/auth/sign-in/social', SocialSignInSchema, {
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      callbackURL: `${origin}/`,
      errorCallbackURL: `${origin}/entrar?error=google`,
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
