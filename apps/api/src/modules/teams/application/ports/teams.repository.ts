import type { MatchFormat } from '@sdl/contracts';

export interface TeamRecord {
  id: string;
  name: string;
  format: MatchFormat;
  season: string;
  club: { id: string; name: string };
}

export interface TeamsRepository {
  findById(teamId: string): Promise<TeamRecord | null>;
}

export const TEAMS_REPOSITORY = Symbol('TEAMS_REPOSITORY');
