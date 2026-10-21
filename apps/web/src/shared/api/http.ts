import { ErrorBodySchema } from '@sdl/contracts';
import type { z } from 'zod';

import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Llama al API con la cookie de sesión (credentials: include) y valida la respuesta
 * con su esquema de @sdl/contracts.
 */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, init);
  return schema.parse(await res.json());
}

/** Igual que apiRequest pero sin cuerpo de respuesta que validar. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('content-type', 'application/json');

  const res = await fetch(new URL(path, API_URL), { ...init, headers, credentials: 'include' });
  if (!res.ok) throw await toApiError(res);
  return res;
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = ErrorBodySchema.safeParse(await res.json().catch(() => null));
  return body.success
    ? new ApiError(res.status, body.data.error.code, body.data.error.message)
    : new ApiError(res.status, 'HTTP_ERROR', res.statusText);
}
