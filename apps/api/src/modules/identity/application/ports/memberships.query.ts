import type { MeResponse } from '@sdl/contracts';

/** Equipos y clubs activos del usuario para `/me`. Lo implementa el módulo teams. */
export interface MembershipsQuery {
  listForUser(userId: string): Promise<Pick<MeResponse, 'teams' | 'clubs'>>;
}

export const MEMBERSHIPS_QUERY = Symbol('MEMBERSHIPS_QUERY');
