import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  LegacyResultsRepository,
  StoredLegacyResult,
} from '../application/ports/legacy-results.repository.js';
import { legacyResult } from './schema.js';

@Injectable()
export class DrizzleLegacyResultsRepository implements LegacyResultsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async insertMany(
    teamId: string,
    importedBy: string,
    rows: Parameters<LegacyResultsRepository['insertMany']>[2],
  ) {
    if (rows.length === 0) return 0;
    const inserted = await this.connection.db
      .insert(legacyResult)
      .values(
        rows.map((row) => ({
          teamId,
          importedBy,
          playerName: row.playerName,
          playerUserId: row.playerUserId,
          takenAt: row.takenAt,
          format: row.format,
          winner: row.winner,
          affinityPct: row.affinityPct,
          podium: row.podium,
          prepScore: row.prepScore,
          prepTotal: row.prepTotal,
          raw: row.raw,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: legacyResult.id });
    return inserted.length;
  }

  async listByTeam(teamId: string): Promise<StoredLegacyResult[]> {
    const rows = await this.connection.db
      .select({
        id: legacyResult.id,
        playerName: legacyResult.playerName,
        playerUserId: legacyResult.playerUserId,
        takenAt: legacyResult.takenAt,
        format: legacyResult.format,
        winner: legacyResult.winner,
        affinityPct: legacyResult.affinityPct,
        podium: legacyResult.podium,
        prepScore: legacyResult.prepScore,
        prepTotal: legacyResult.prepTotal,
        importedAt: legacyResult.importedAt,
      })
      .from(legacyResult)
      .where(eq(legacyResult.teamId, teamId))
      .orderBy(desc(legacyResult.takenAt));
    // Postgres devuelve "YYYY-MM-DD HH:mm:ss"; el contrato pide "YYYY-MM-DDTHH:mm".
    // Por nombre con las reglas del español (la intercalación de la BD pone "Z" antes que "a").
    return rows
      .map((row) => ({ ...row, takenAt: row.takenAt?.slice(0, 16).replace(' ', 'T') ?? null }))
      .sort((a, b) => a.playerName.localeCompare(b.playerName, 'es', { sensitivity: 'base' }));
  }
}
