import type { DominantFoot } from '@sdl/contracts';
import type { PositionCode } from '@sdl/domain';

export interface StoredPreferences {
  displayName: string;
  dominantFoot: DominantFoot | null;
  playsGoalkeeper: boolean;
}

export interface StoredProfile {
  preferences: StoredPreferences | null;
  positions: PositionCode[];
  photoKey: string | null;
}

export interface ProfileRepository {
  /** Preferencias guardadas (null si nunca editó su perfil) y posiciones en orden. */
  find(userId: string): Promise<StoredProfile>;
  /** Lo mismo que find para varios usuarios. */
  findMany(userIds: string[]): Promise<Map<string, StoredProfile>>;
  /** Pone o quita la foto; crea el perfil con `displayName` si todavía no existía. */
  setPhotoKey(userId: string, photoKey: string | null, displayName: string): Promise<void>;
  savePreferences(userId: string, preferences: StoredPreferences): Promise<void>;
  /** Reemplaza la lista completa, en orden (rank 1..n). */
  replacePositions(userId: string, positions: PositionCode[]): Promise<void>;
}

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
