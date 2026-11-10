import type { BirthYears, RegisterMinorRequest } from '@sdl/contracts';
import { ADULT_AGE } from '@sdl/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { registerMinor } from '../../shared/api/family';
import { acceptConsent } from '../../shared/api/teams';
import { SESSION_KEY } from '../auth/use-session';

/**
 * Inscribir al hijo con el enlace para acudientes (2026-11-10). Si el acudiente todavía no
 * aceptó la política, la acepta primero, en el mismo toque (el API exige ese orden).
 */
export function useRegisterMinor(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      withConsent,
      request,
    }: {
      withConsent: boolean;
      request: RegisterMinorRequest;
    }) => {
      if (withConsent) await acceptConsent();
      return registerMinor(code, request);
    },
    // `/me` trae al niño en `children`.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

/**
 * Los años que se pueden elegir: los de la categoría que todavía son de menores (un mayor de
 * edad entra con su cuenta). Sin años, ninguno.
 */
export function minorYears(years: BirthYears | null, thisYear: number): number[] {
  if (!years) return [];
  const first = Math.max(years.from ?? years.to, thisYear - ADULT_AGE + 1);
  const last = Math.min(years.to, thisYear);
  const out: number[] = [];
  for (let y = first; y <= last; y++) out.push(y);
  return out;
}
