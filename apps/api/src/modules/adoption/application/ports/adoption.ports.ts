/** Lo que el tablero de adopción lee de varios módulos (lo implementa su infraestructura). */
export interface AdoptionRepository {
  /** La última vez que cada uno usó su sesión (Better Auth la renueva una vez al día). */
  lastSeen(userIds: string[]): Promise<Map<string, Date>>;
  /** Quiénes tienen los avisos activados en algún celular o navegador. */
  withNotices(userIds: string[]): Promise<Set<string>>;
  /** La convocatoria más reciente del equipo que no se canceló, con quiénes respondieron. */
  lastCallUp(
    teamId: string,
  ): Promise<{ id: string; opponent: string | null; startsAt: Date; replied: Set<string> } | null>;
}
export const ADOPTION_REPOSITORY = Symbol('ADOPTION_REPOSITORY');
