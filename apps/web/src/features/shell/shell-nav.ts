import type { MatchFormat, TeamRole } from '@sdl/contracts';

export type TabId = 'inicio' | 'plantilla' | 'partidos' | 'mi-juego' | 'equipo';

export interface Tab {
  id: TabId;
  label: string;
  /** A dónde lleva la pestaña. */
  to: string;
  /** Rutas que cuentan como "estar" en esta pestaña ("/" solo cuenta exacta). */
  match: readonly string[];
}

/** Las pestañas del rol en el equipo activo (07 §4.2): máximo cinco. */
export function tabsFor(teamId: string, roles: readonly TeamRole[]): Tab[] {
  const team = `/equipos/${teamId}`;
  const staff = roles.includes('coach') || roles.includes('assistant');
  const player = roles.includes('player');
  const tabs: Tab[] = [{ id: 'inicio', label: 'Inicio', to: '/', match: ['/'] }];
  if (staff) {
    tabs.push({
      id: 'plantilla',
      label: 'Plantilla',
      to: `${team}/plantilla`,
      match: [`${team}/plantilla`],
    });
  }
  // Partidos: la convocatoria, responder y (adentro) las alineaciones. Para todos.
  if (staff || player) {
    tabs.push({
      id: 'partidos',
      label: 'Partidos',
      to: `${team}/partidos`,
      match: [`${team}/partidos`, `${team}/alineaciones`, `${team}/planificador`],
    });
  }
  if (player) {
    tabs.push({
      id: 'mi-juego',
      label: 'Mi juego',
      to: `${team}/mi-juego`,
      match: [
        `${team}/mi-juego`,
        `${team}/tarjeta`,
        '/conocimiento',
        '/historial',
        '/perfil',
        '/resultados',
      ],
    });
  }
  tabs.push({
    id: 'equipo',
    label: 'Equipo',
    to: `${team}/equipo`,
    match: [`${team}/equipo`, `${team}/invitar`, `${team}/validacion`, '/bases'],
  });
  return tabs;
}

const within = (pathname: string, base: string) =>
  base === '/' ? pathname === '/' : pathname === base || pathname.startsWith(`${base}/`);

/** La pestaña en la que estás, o ninguna (una pantalla de otro equipo, por ejemplo). */
export function activeTab(pathname: string, tabs: readonly Tab[]): Tab | undefined {
  return tabs.find((tab) => tab.match.some((base) => within(pathname, base)));
}

const TEAM_PATH = /^\/equipos\/([^/]+)/;

/** El equipo de la URL ("/equipos/:teamId/…"), si lo hay. */
export const teamFromPath = (pathname: string) => TEAM_PATH.exec(pathname)?.[1] ?? null;

/**
 * Al cambiar de equipo: la misma pestaña en el otro, si tu rol allá la tiene; si no, el
 * inicio.
 */
export function switchTarget(current: TabId | undefined, target: readonly Tab[]): string {
  return target.find((tab) => tab.id === current)?.to ?? '/';
}

const ROLE_LABEL: Record<TeamRole, string> = {
  coach: 'Entrenador',
  assistant: 'Asistente',
  player: 'Jugador',
};

/** "Entrenador y jugador". */
export function rolesLabel(roles: readonly TeamRole[]): string {
  const words = roles.map((r, i) => (i === 0 ? ROLE_LABEL[r] : ROLE_LABEL[r].toLowerCase()));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words.at(-1)}` : (words[0] ?? '');
}

export const FORMAT_LABEL: Record<MatchFormat, string> = { F11: 'Fútbol 11', F8: 'Fútbol 8' };

/** "Fútbol 11" o, si juega los dos, "Fútbol 11 y 8" (el principal primero). */
export function formatsLabel(formats: readonly MatchFormat[], principal: MatchFormat): string {
  const others = formats.filter((f) => f !== principal).map((f) => f.slice(1));
  return others.length
    ? `${FORMAT_LABEL[principal]} y ${others.join(' y ')}`
    : FORMAT_LABEL[principal];
}
