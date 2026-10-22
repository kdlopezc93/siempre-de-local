import { Inject, Injectable } from '@nestjs/common';
import type { Lineup, MatchFormat } from '@sdl/contracts';
import { desc, eq } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { user } from '../../identity/infrastructure/schema.js';
import type { LineupData, LineupsRepository } from '../application/ports/lineups.repository.js';
import { lineup } from './schema.js';

@Injectable()
export class DrizzleLineupsRepository implements LineupsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  private select() {
    return this.connection.db
      .select({ row: lineup, creatorName: user.name })
      .from(lineup)
      .leftJoin(user, eq(lineup.createdBy, user.id));
  }

  private toLineup({
    row,
    creatorName,
  }: Awaited<ReturnType<DrizzleLineupsRepository['select']>>[number]): Lineup & { teamId: string } {
    return {
      id: row.id,
      teamId: row.teamId,
      name: row.name,
      matchDate: row.matchDate,
      format: row.format,
      formation: row.formation,
      mode: row.mode,
      weights: row.weights,
      priority: row.priority,
      minKnowledgePct: row.minKnowledgePct,
      fitVersion: row.fitVersion,
      available: row.available,
      pins: row.pins,
      assignments: row.assignments,
      bench: row.bench,
      createdBy: row.createdBy ? { id: row.createdBy, name: creatorName ?? '' } : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(teamId: string, createdBy: string, format: MatchFormat, data: LineupData) {
    const [row] = await this.connection.db
      .insert(lineup)
      .values({ ...data, teamId, createdBy, format })
      .returning({ id: lineup.id });
    return (await this.find(row!.id))!;
  }

  async update(lineupId: string, format: MatchFormat, data: LineupData) {
    await this.connection.db
      .update(lineup)
      .set({ ...data, format })
      .where(eq(lineup.id, lineupId));
    return (await this.find(lineupId))!;
  }

  async find(lineupId: string) {
    const [row] = await this.select().where(eq(lineup.id, lineupId));
    return row ? this.toLineup(row) : null;
  }

  async listByTeam(teamId: string) {
    const rows = await this.select()
      .where(eq(lineup.teamId, teamId))
      .orderBy(desc(lineup.updatedAt));
    return rows.map((r) => this.toLineup(r));
  }

  async delete(lineupId: string) {
    await this.connection.db.delete(lineup).where(eq(lineup.id, lineupId));
  }
}
