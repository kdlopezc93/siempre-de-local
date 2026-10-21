import type { Profile } from '@sdl/contracts';

/** Perfil para `/me`, con valores por defecto si no existe. Lo implementa player-profile. */
export interface ProfileQuery {
  profileOf(user: { id: string; name: string }): Promise<Profile>;
}

export const PROFILE_QUERY = Symbol('PROFILE_QUERY');
