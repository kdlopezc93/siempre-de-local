import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { charge } from '../../charges/infrastructure/schema.js';
import { teamMatch, tournament } from '../../matches/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';
import type { PreviewsRepository } from '../application/ports/previews.ports.js';

@Injectable()
export class DrizzlePreviewsRepository implements PreviewsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async match(matchId: string) {
    const [row] = await this.connection.db
      .select({
        team: team.name,
        kind: teamMatch.kind,
        opponent: teamMatch.opponent,
        tournament: tournament.name,
        startsAt: teamMatch.startsAt,
        status: teamMatch.status,
      })
      .from(teamMatch)
      .innerJoin(team, eq(teamMatch.teamId, team.id))
      .leftJoin(tournament, eq(teamMatch.tournamentId, tournament.id))
      .where(eq(teamMatch.id, matchId));
    if (!row) return null;
    const { status, ...rest } = row;
    return { ...rest, cancelled: status === 'cancelled' };
  }

  async charge(chargeId: string) {
    const [row] = await this.connection.db
      .select({
        team: team.name,
        kind: charge.kind,
        title: charge.title,
        opponent: teamMatch.opponent,
        startsAt: teamMatch.startsAt,
        tournament: tournament.name,
        cancelledAt: charge.cancelledAt,
      })
      .from(charge)
      .innerJoin(team, eq(charge.teamId, team.id))
      .leftJoin(teamMatch, eq(charge.matchId, teamMatch.id))
      .leftJoin(tournament, eq(charge.tournamentId, tournament.id))
      .where(eq(charge.id, chargeId));
    if (!row) return null;
    return {
      team: row.team,
      kind: row.kind,
      title: row.title,
      match: row.startsAt ? { opponent: row.opponent, startsAt: row.startsAt } : null,
      tournament: row.tournament,
      cancelled: row.cancelledAt !== null,
    };
  }
}
