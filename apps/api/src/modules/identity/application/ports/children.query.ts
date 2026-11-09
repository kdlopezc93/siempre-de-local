import type { Child } from '@sdl/contracts';

/** Los menores a cargo del acudiente, para `/me` (2026-11-08). Lo implementa el módulo families. */
export interface ChildrenQuery {
  childrenOf(guardianUserId: string): Promise<Child[]>;
}

export const CHILDREN_QUERY = Symbol('CHILDREN_QUERY');
