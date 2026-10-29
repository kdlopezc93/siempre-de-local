export interface ClubCodeRecord {
  id: string;
  note: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  club: { id: string; name: string } | null;
}

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
}

export const CLUB_CODES_REPOSITORY = Symbol('CLUB_CODES_REPOSITORY');
