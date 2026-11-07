import { useSession } from '../auth/use-session';

/** Los colores del equipo para los afiches (2026-11-06), de la sesión; null: los de la app. */
export function useTeamColors(teamId: string): readonly string[] | null {
  const session = useSession();
  return session.data?.teams.find((t) => t.team.id === teamId)?.team.colors ?? null;
}
