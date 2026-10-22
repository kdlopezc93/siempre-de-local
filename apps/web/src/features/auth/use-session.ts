import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchMe, signOut, signOutEverywhere, startGoogleSignIn } from '../../shared/api/auth';
import { clearApiCache } from '../../shared/offline/api-cache';

export const SESSION_KEY = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
    // Sin red, el service worker responde con la última sesión conocida (ADR-06).
    networkMode: 'offlineFirst',
  });
}

/** `returnTo`: ruta de la app a la que vuelve Google (por defecto, el inicio). */
export function useGoogleSignIn(returnTo = '/') {
  const mutation = useMutation({
    mutationFn: () => startGoogleSignIn(returnTo),
    onSuccess: (url) => window.location.assign(url),
  });
  const { reset } = mutation;

  // Si vuelve atrás desde Google, el navegador restaura la página desde bfcache
  // con el botón en "Abriendo Google…": se reinicia para poder intentar de nuevo.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [reset]);

  return mutation;
}

function useEndSession(end: () => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await end();
      await clearApiCache();
    },
    onSuccess: () => queryClient.setQueryData(SESSION_KEY, null),
  });
}

export const useSignOut = () => useEndSession(signOut);
export const useSignOutEverywhere = () => useEndSession(signOutEverywhere);
