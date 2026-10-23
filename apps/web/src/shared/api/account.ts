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
