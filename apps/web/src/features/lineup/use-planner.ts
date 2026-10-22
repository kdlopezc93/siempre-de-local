import type { LineupInputsResponse } from '@sdl/contracts';
import { findFormation, MODE_WEIGHTS, solveLineup } from '@sdl/domain';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { fetchLineupInputs } from '../../shared/api/lineups';
import * as planner from './planner-state';

export function useLineupInputs(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId, 'lineup-inputs'],
    queryFn: () => fetchLineupInputs(teamId),
    // Sin señal en la cancha, el service worker da la última copia.
    networkMode: 'offlineFirst',
    // Lo armado vive en la pantalla: un refresco no debe pisarlo.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** El planificador: decisiones del entrenador → alineación calculada en el celular. */
export function usePlanner(inputs: LineupInputsResponse, defaultFormation: string) {
  const [state, setState] = useState(() =>
    planner.initialState(
      defaultFormation,
      inputs.players.map((p) => p.playerId),
    ),
  );
  const formation = findFormation(state.formationKey)!;

  const result = useMemo(
    () =>
      solveLineup({
        formation,
        players: inputs.players.filter(
          (p) => state.available.has(p.playerId) && !state.benched.has(p.playerId),
        ),
        weights: MODE_WEIGHTS[state.mode],
        pins: state.pins,
        minKnowledgePct: state.minKnowledgePct,
        priority: state.priority,
      }),
    [formation, inputs.players, state],
  );
  // Los mandados a mano a la banca van al final de la banca.
  const bench = [...result.bench, ...[...state.benched].filter((id) => state.available.has(id))];
  const occupant = (slotId: string) =>
    result.assignments.find((a) => a.slotId === slotId)?.playerId ?? null;

  return {
    state,
    formation,
    result: { ...result, bench },
    setFormation: (key: string) => setState((s) => planner.setFormation(s, key)),
    setMode: (mode: typeof state.mode) => setState((s) => ({ ...s, mode })),
    setPriority: (priority: typeof state.priority) => setState((s) => ({ ...s, priority })),
    setMinKnowledge: (minKnowledgePct: number | null) =>
      setState((s) => ({ ...s, minKnowledgePct })),
    toggleAvailable: (id: string) => setState((s) => planner.toggleAvailable(s, id)),
    callAll: () =>
      setState((s) =>
        planner.setAllAvailable(
          s,
          inputs.players.map((p) => p.playerId),
        ),
      ),
    tapSlot: (slotId: string) => setState((s) => planner.tapSlot(s, slotId, occupant)),
    tapBench: (id: string) => setState((s) => planner.tapBench(s, id)),
    unpin: (slotId: string) => setState((s) => planner.unpin(s, slotId)),
    sendToBench: (id: string) => setState((s) => planner.sendToBench(s, id)),
    clearSelection: () => setState((s) => ({ ...s, selected: null })),
  };
}
