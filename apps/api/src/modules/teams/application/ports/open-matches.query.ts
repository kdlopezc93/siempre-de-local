/**
 * Lo que la invitación necesita de los partidos (lo implementa el módulo matches): los que
 * siguen abiertos, para avisarle al que entra tarde (2026-10-26). Equipos no conoce a partidos.
 */
export interface OpenMatchesQuery {
  openMatches(
    teamId: string,
    now: Date,
  ): Promise<{ id: string; opponent: string; startsAt: Date }[]>;
}

export const OPEN_MATCHES_QUERY = Symbol('OPEN_MATCHES_QUERY');
