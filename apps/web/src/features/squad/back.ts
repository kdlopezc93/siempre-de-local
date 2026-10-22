import { useLocation } from 'react-router';

/**
 * A dónde vuelve una pantalla que se abre desde varios lados (p. ej. valorar desde la
 * plantilla o desde el perfil): quien la abre lo manda en el estado del enlace.
 */
export function useBackTo(fallback: string): string {
  const state: unknown = useLocation().state;
  const back = (state as { back?: unknown } | null)?.back;
  return typeof back === 'string' && back.startsWith('/equipos/') ? back : fallback;
}
