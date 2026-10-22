import type { Assessment } from '@sdl/contracts';
import type { PositionCode } from '@sdl/domain';

export interface NewAssessment {
  teamId: string;
  playerUserId: string;
  coachUserId: string;
  primaryPosition: PositionCode;
  secondaryPositions: PositionCode[];
  confidence: number;
  blind: boolean;
  notes: string | null;
}

export interface AssessmentsRepository {
  create(input: NewAssessment): Promise<Assessment>;
  /** Del más reciente al más antiguo; de un jugador si se indica. */
  listByTeam(teamId: string, playerUserId?: string): Promise<Assessment[]>;
  /** Jugadores del equipo que esta persona ya valoró alguna vez. */
  assessedBy(coachUserId: string, teamId: string): Promise<Set<string>>;
  /** La valoración más reciente de cada jugador del equipo. */
  latestByTeam(teamId: string): Promise<Map<string, Assessment>>;
}

export const ASSESSMENTS_REPOSITORY = Symbol('ASSESSMENTS_REPOSITORY');
