import type { Lineup, LineupInput, MatchFormat } from '@sdl/contracts';

export type LineupData = Required<Omit<LineupInput, 'pins'>> & { pins: LineupInput['pins'] };

export interface LineupsRepository {
  create(teamId: string, createdBy: string, format: MatchFormat, data: LineupData): Promise<Lineup>;
  update(lineupId: string, data: LineupData): Promise<Lineup>;
  find(lineupId: string): Promise<(Lineup & { teamId: string }) | null>;
  listByTeam(teamId: string): Promise<Lineup[]>;
  delete(lineupId: string): Promise<void>;
}

export const LINEUPS_REPOSITORY = Symbol('LINEUPS_REPOSITORY');
