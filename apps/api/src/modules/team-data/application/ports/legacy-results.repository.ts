import type { LegacyRow, MatchFormat, PositionCode } from '@sdl/domain';

export interface StoredLegacyResult {
  id: string;
  playerName: string;
  playerUserId: string | null;
  takenAt: string | null;
  format: MatchFormat | null;
  winner: PositionCode;
  affinityPct: number | null;
  podium: PositionCode[];
  prepScore: number | null;
  prepTotal: number | null;
  importedAt: Date;
}

export interface LegacyResultsRepository {
  /** Inserta las filas nuevas; las repetidas se ignoran. Devuelve cuántas entraron. */
  insertMany(
    teamId: string,
    importedBy: string,
    rows: (LegacyRow & { playerUserId: string | null })[],
  ): Promise<number>;
  listByTeam(teamId: string): Promise<StoredLegacyResult[]>;
}

export const LEGACY_RESULTS_REPOSITORY = Symbol('LEGACY_RESULTS_REPOSITORY');
