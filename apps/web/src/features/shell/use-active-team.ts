import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { teamFromPath } from './shell-nav';

const KEY = 'sdl.equipoActivo';

/*
 * El equipo elegido es uno solo para toda la app (2026-11-10): el encabezado y el inicio lo leen
 * de aquí y se enteran cuando cambia. Antes cada uno guardaba su copia y, al cambiar de equipo en
 * el inicio, el encabezado mostraba el nuevo y "lo que toca" seguía siendo del anterior.
 * Vive en este celular (una comodidad); sin almacenamiento (modo privado), en memoria.
 */
let memory: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function snapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}
function setChosen(teamId: string) {
  if (snapshot() === teamId) return;
  memory = teamId;
  try {
    localStorage.setItem(KEY, teamId);
  } catch {
    // Queda en memoria.
  }
  for (const listener of listeners) listener();
}

/**
 * El equipo activo: el de la URL; si la pantalla no es de un equipo (el inicio, el
 * conocimiento), el último que usaste en este celular; si no, el primero.
 */
export function useActiveTeam(me: Me) {
  const { pathname } = useLocation();
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const mine = (id: string | null) => (id ? me.teams.find((t) => t.team.id === id) : undefined);
  const active = mine(teamFromPath(pathname)) ?? mine(current) ?? me.teams[0];
  const activeId = active?.team.id;

  useEffect(() => {
    if (activeId) setChosen(activeId);
  }, [activeId]);

  return { active, choose: setChosen };
}
