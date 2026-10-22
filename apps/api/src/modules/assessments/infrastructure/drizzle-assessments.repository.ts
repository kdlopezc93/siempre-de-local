import { Inject, Injectable } from '@nestjs/common';
import type { Assessment } from '@sdl/contracts';
import { and, desc, eq } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { user } from '../../identity/infrastructure/schema.js';
import type {
  AssessmentsRepository,
  NewAssessment,
} from '../application/ports/assessments.repository.js';
import { coachAssessment } from './schema.js';

const SELECTION = {
  id: coachAssessment.id,
  playerId: coachAssessment.playerUserId,
  assessorId: coachAssessment.coachUserId,
  assessorName: user.name,
  primaryPosition: coachAssessment.primaryPosition,
  secondaryPositions: coachAssessment.secondaryPositions,
  confidence: coachAssessment.confidence,
  blind: coachAssessment.blind,
  notes: coachAssessment.notes,
  createdAt: coachAssessment.createdAt,
};

type Row = {
  id: string;
  playerId: string;
  assessorId: string | null;
  assessorName: string | null;
  primaryPosition: Assessment['primaryPosition'];
  secondaryPositions: Assessment['secondaryPositions'];
  confidence: number;
  blind: boolean;
  notes: string | null;
  createdAt: Date;
};

const toAssessment = ({ assessorId, assessorName, createdAt, ...rest }: Row): Assessment => ({
  ...rest,
  assessor: assessorId ? { id: assessorId, name: assessorName ?? '' } : null,
  createdAt: createdAt.toISOString(),
});

@Injectable()
export class DrizzleAssessmentsRepository implements AssessmentsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  private select() {
    return this.connection.db
      .select(SELECTION)
      .from(coachAssessment)
      .leftJoin(user, eq(coachAssessment.coachUserId, user.id));
  }

  async create(input: NewAssessment): Promise<Assessment> {
    const [{ id }] = (await this.connection.db
      .insert(coachAssessment)
      .values(input)
      .returning({ id: coachAssessment.id })) as [{ id: string }];
    const [row] = await this.select().where(eq(coachAssessment.id, id));
    return toAssessment(row!);
  }

  async listByTeam(teamId: string, playerUserId?: string): Promise<Assessment[]> {
    const rows = await this.select()
      .where(
        playerUserId
          ? and(eq(coachAssessment.teamId, teamId), eq(coachAssessment.playerUserId, playerUserId))
          : eq(coachAssessment.teamId, teamId),
      )
      .orderBy(desc(coachAssessment.createdAt));
    return rows.map(toAssessment);
  }

  async assessedBy(coachUserId: string, teamId: string): Promise<Set<string>> {
    const rows = await this.connection.db
      .selectDistinct({ playerId: coachAssessment.playerUserId })
      .from(coachAssessment)
      .where(and(eq(coachAssessment.teamId, teamId), eq(coachAssessment.coachUserId, coachUserId)));
    return new Set(rows.map((r) => r.playerId));
  }

  async latestByTeam(teamId: string): Promise<Map<string, Assessment>> {
    const latest = new Map<string, Assessment>();
    // Ya vienen del más reciente al más antiguo: se queda la primera de cada jugador.
    for (const assessment of await this.listByTeam(teamId)) {
      if (!latest.has(assessment.playerId)) latest.set(assessment.playerId, assessment);
    }
    return latest;
  }
}
