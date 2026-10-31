import type { TeamRole } from '@sdl/contracts';
import { useQuery } from '@tanstack/react-query';

import type { Me } from '../../shared/api/auth';
import { fetchCertPositions } from '../../shared/api/certification';
import { fetchLineups } from '../../shared/api/lineups';
import { fetchMatches } from '../../shared/api/matches';
import { fetchSquad } from '../../shared/api/squad';
import { useHistory } from '../history/use-history';
import { useCharges, useMyCharges } from '../charges/use-charges';
import { chargeTodos, lastLineup, matchTodos, playerTodos, staffTodos, type Todo } from './todo';

/**
 * Lo que toca en el equipo activo, armado en el celular con lo que ya traen la plantilla,
 * el examen, el historial y las alineaciones (comparten caché con esas pantallas, así que
 * funciona sin señal con lo último que se vio).
 */
export function useHomeTodos(me: Me, teamId: string | undefined, roles: readonly TeamRole[]) {
  const staff = roles.includes('coach') || roles.includes('assistant');
  const player = roles.includes('player');
  // Quien cobra (`06` Cobros): el cuerpo técnico y el tesorero.
  const money = staff || roles.includes('treasurer');
  const history = useHistory(me.user.id);
  const myCharges = useMyCharges(teamId ?? '', player && !!teamId);
  const charges = useCharges(teamId ?? '', money && !!teamId);
  const positions = useQuery({
    queryKey: ['cert-positions'],
    queryFn: fetchCertPositions,
    enabled: player,
    networkMode: 'offlineFirst',
  });
  const squad = useQuery({
    queryKey: ['team', teamId, 'squad'],
    queryFn: () => fetchSquad(teamId!),
    enabled: staff && !!teamId,
    networkMode: 'offlineFirst',
  });
  const matches = useQuery({
    queryKey: ['team', teamId, 'matches'],
    queryFn: () => fetchMatches(teamId!),
    enabled: (staff || player) && !!teamId,
    networkMode: 'offlineFirst',
  });
  const lineups = useQuery({
    queryKey: ['team', teamId, 'lineups'],
    queryFn: () => fetchLineups(teamId!),
    enabled: staff && !!teamId,
    networkMode: 'offlineFirst',
  });

  const parts = [
    ...(player ? [history.isPending, positions.isPending] : []),
    ...(staff ? [squad.isPending] : []),
  ];
  const isPending = parts.some(Boolean);
  const isError = (player && positions.isError) || (staff && squad.isError);

  const todos: Todo[] = [];
  let shortcut: Todo | null = null;
  if (teamId && !isPending) {
    if (player && positions.data) {
      todos.push(
        ...playerTodos({
          teamId,
          // Si el historial no cargó, no sabemos: mejor no pedirle un test que quizá ya hizo.
          testDone:
            history.isError ||
            history.entries.some((e) =>
              e.kind === 'official' ? e.result.teamId === teamId : e.teamId === teamId,
            ),
          positions: positions.data.positions,
          now: new Date(),
        }),
      );
    }
    if (staff && squad.data) todos.push(...staffTodos({ teamId, squad: squad.data.players }));
    if (matches.data)
      todos.push(
        ...matchTodos({ teamId, matches: matches.data.items, player, staff, meId: me.user.id }),
      );
    if (staff && lineups.data) shortcut = lastLineup(teamId, lineups.data.items);
    todos.push(
      ...chargeTodos({
        teamId,
        mine: myCharges.data
          ? {
              owed: myCharges.data.owed,
              open: myCharges.data.items.filter((i) => i.status !== 'paid').length,
            }
          : null,
        reported: charges.data
          ? charges.data.items.reduce((n, c) => n + (c.cancelled ? 0 : c.reported), 0)
          : null,
      }),
    );
  }
  return { todos, shortcut, isPending, isError, staff, player, money };
}
