import { apiFetch } from './http';

/** El CSV de la plantilla, con el nombre de archivo que propone el API. */
export async function downloadTeamExport(
  teamId: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(`/api/v1/teams/${teamId}/export.csv`);
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'plantilla.csv';
  return { blob: await res.blob(), filename };
}
