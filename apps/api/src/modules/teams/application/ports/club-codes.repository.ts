export interface ClubCodeRecord {
  id: string;
  note: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  club: { id: string; name: string } | null;
}

import type { MatchFormat } from '@sdl/contracts';

export interface NewClub {
  clubName: string;
  city: string;
  teamName: string;
  category: string | null;
  format: MatchFormat;
  season: string;
  /** Además de entrenador, juega en su equipo. */
  alsoPlays: boolean;
}

/** `unavailable`: el código dejó de servir mientras tanto; `limit`: ya es dueño de un club. */
export type CreateClubOutcome = { clubId: string; teamId: string } | 'unavailable' | 'limit';

export interface ClubCodesRepository {
  create(input: {
    codeHash: string;
    note: string | null;
    createdBy: string;
    expiresAt: Date;
  }): Promise<ClubCodeRecord>;
  /** Del más reciente al más antiguo. */
  list(): Promise<ClubCodeRecord[]>;
  find(id: string): Promise<ClubCodeRecord | null>;
  revoke(id: string, at: Date): Promise<void>;
  findByCodeHash(codeHash: string): Promise<ClubCodeRecord | null>;
  /**
   * En una transacción: gasta el código (si todavía sirve), crea el club con un slug libre y a
   * quien lo usa de dueño, y su primer equipo con él de entrenador (y jugador, si juega).
   */
  createClub(codeId: string, userId: string, club: NewClub, now: Date): Promise<CreateClubOutcome>;
}

export const CLUB_CODES_REPOSITORY = Symbol('CLUB_CODES_REPOSITORY');
