import type { DominantFoot } from '@sdl/contracts';
import type { PositionCode } from '@sdl/domain';

export interface StoredPreferences {
  displayName: string;
  dominantFoot: DominantFoot | null;
  playsGoalkeeper: boolean;
}

export interface ProfileRepository {
  /** Preferencias guardadas (null si nunca editó su perfil) y posiciones en orden. */
  find(
    userId: string,
  ): Promise<{ preferences: StoredPreferences | null; positions: PositionCode[] }>;
  /** Lo mismo que find para varios usuarios. */
  findMany(
    userIds: string[],
  ): Promise<Map<string, { preferences: StoredPreferences | null; positions: PositionCode[] }>>;
  savePreferences(userId: string, preferences: StoredPreferences): Promise<void>;
  /** Reemplaza la lista completa, en orden (rank 1..n). */
  replacePositions(userId: string, positions: PositionCode[]): Promise<void>;
}

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
