import { apiFetch } from './http';

/** Tus datos en JSON, para guardar en el celular (`GET /me/export`). */
export async function downloadMyData(): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch('/api/v1/me/export');
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'mis-datos.json';
  return { blob: await res.blob(), filename };
}

/** Elimina tu cuenta y todo lo tuyo. Hay que escribir ELIMINAR. */
export async function deleteAccount(): Promise<void> {
  await apiFetch('/api/v1/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'ELIMINAR' }),
  });
}

/**
 * Los datos de un hijo, como su acudiente (2026-11-10, `GET /me/children/:minorId/export`).
 */
export async function downloadChildData(
  minorId: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(`/api/v1/me/children/${minorId}/export`);
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'datos-de-mi-hijo.json';
  return { blob: await res.blob(), filename };
}

/** Borra al hijo y todo lo suyo (retira la autorización). Hay que escribir ELIMINAR. */
export async function deleteChild(minorId: string): Promise<void> {
  await apiFetch(`/api/v1/me/children/${minorId}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'ELIMINAR' }),
  });
}
