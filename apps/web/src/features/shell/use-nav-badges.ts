import type { Match, MyChargesResponse, TeamRole } from '@sdl/contracts';

import { useCharges, useMyCharges } from '../charges/use-charges';
import { useMatches } from '../matches/use-matches';
import type { TabId } from './shell-nav';

/**
 * Los globos de la barra (2026-10-30, Kevin): guían a lo pendiente. En Partidos, las
 * convocatorias abiertas sin responder; en Mi juego, los cobros que todavía debe; en Equipo,
 * los "Ya pagué" que esperan que quien cobra los confirme.
 */
export function navBadges(input: {
  matches: readonly Pick<Match, 'open' | 'myReply'>[] | null;
  myCharges: Pick<MyChargesResponse, 'items'> | null;
  reported: number | null;
}): Partial<Record<TabId, number>> {
  const badges: Partial<Record<TabId, number>> = {};
  const unanswered = input.matches?.filter((m) => m.open && !m.myReply).length ?? 0;
  if (unanswered) badges.partidos = unanswered;
  const owed = input.myCharges?.items.filter((i) => i.status !== 'paid').length ?? 0;
  if (owed) badges['mi-juego'] = owed;
  if (input.reported) badges.equipo = input.reported;
  return badges;
}

/** Lo mismo con los datos del equipo activo (comparten caché con sus pantallas). */
export function useNavBadges(teamId: string, roles: readonly TeamRole[]) {
  const player = roles.includes('player');
  const money =
    roles.includes('coach') || roles.includes('assistant') || roles.includes('treasurer');
  const matches = useMatches(teamId, player);
  const myCharges = useMyCharges(teamId, player);
  const charges = useCharges(teamId, money);
  return navBadges({
    matches: player ? (matches.data?.items ?? null) : null,
    myCharges: player ? (myCharges.data ?? null) : null,
    reported: money
      ? (charges.data?.items.reduce((n, c) => n + (c.cancelled ? 0 : c.reported), 0) ?? null)
      : null,
  });
}
