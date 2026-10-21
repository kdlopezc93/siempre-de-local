import type { PositionCode, Profile } from '@sdl/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setPreferredPositions, updateProfile } from '../../shared/api/profile';
import { SESSION_KEY } from '../auth/use-session';

/** Guarda el perfil y, si cambiaron, las posiciones preferidas; luego refresca `/me`. */
export function useSaveProfile(current: Profile) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (next: Profile) => {
      await updateProfile({
        displayName: next.displayName,
        dominantFoot: next.dominantFoot,
        playsGoalkeeper: next.playsGoalkeeper,
      });
      if (next.preferredPositions.join() !== current.preferredPositions.join()) {
        await setPreferredPositions(next.preferredPositions);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

/** Tocar una posición la suma al final (hasta 3) o la quita y corre las demás. */
export function togglePreference(list: PositionCode[], pos: PositionCode): PositionCode[] {
  if (list.includes(pos)) return list.filter((p) => p !== pos);
  return list.length < 3 ? [...list, pos] : list;
}
