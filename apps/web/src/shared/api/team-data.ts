import {
  LegacyImportResponseSchema,
  LegacyResultListResponseSchema,
  type LegacyImportResponse,
  type LegacyResult,
} from '@sdl/contracts';

import { apiFetch, apiRequest } from './http';

/** El CSV de la plantilla, con el nombre de archivo que propone el API. */
export async function downloadTeamExport(
  teamId: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(`/api/v1/teams/${teamId}/export.csv`);
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'plantilla.csv';
  return { blob: await res.blob(), filename };
}

export function importLegacyCsv(teamId: string, csv: string): Promise<LegacyImportResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/legacy-import`, LegacyImportResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
}

export async function fetchLegacyResults(teamId: string): Promise<LegacyResult[]> {
  const { items } = await apiRequest(
    `/api/v1/teams/${teamId}/legacy-results`,
    LegacyResultListResponseSchema,
  );
  return items;
}
