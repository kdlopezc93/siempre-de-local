import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  downloadTeamExport,
  fetchLegacyResults,
  importLegacyCsv,
} from '../../shared/api/team-data';
import { saveFile } from '../../shared/save-file';

/** El mismo tope que el API (contrato LegacyImportRequest). */
const MAX_CSV_CHARS = 512_000;

export class CsvTooBigError extends Error {
  override readonly name = 'CsvTooBigError';
}

const legacyKey = (teamId: string) => ['team', teamId, 'legacy-results'] as const;

export function useExportTeam(teamId: string) {
  return useMutation({
    mutationFn: () => downloadTeamExport(teamId),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });
}

export function useLegacyResults(teamId: string) {
  return useQuery({ queryKey: legacyKey(teamId), queryFn: () => fetchLegacyResults(teamId) });
}

/**
 * Importa uno o varios CSV del prototipo. Los archivos se leen en el celular y viajan como
 * texto, uno tras otro: el lector salta los encabezados repetidos.
 */
export function useImportLegacy(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: { files: readonly File[]; pasted: string }) => {
      const texts = await Promise.all(source.files.map((file) => file.text()));
      const csv = [...texts, source.pasted]
        .map((t) => t.trim())
        .filter(Boolean)
        .join('\n');
      if (csv.length > MAX_CSV_CHARS) throw new CsvTooBigError();
      return importLegacyCsv(teamId, csv);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: legacyKey(teamId) }),
  });
}
