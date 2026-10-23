import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { teamFromPath } from './shell-nav';

const KEY = 'sdl.equipoActivo';

// Solo una comodidad de este celular: si falla (modo privado), se usa el primer equipo.
function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function write(teamId: string) {
  try {
    localStorage.setItem(KEY, teamId);
  } catch {
    // Sin almacenamiento, la próxima vez abre en el primer equipo.
  }
}

/**
 * El equipo activo: el de la URL; si la pantalla no es de un equipo (el inicio, el
 * conocimiento), el último que usaste en este celular; si no, el primero.
 */
export function useActiveTeam(me: Me) {
  const { pathname } = useLocation();
  const [chosen, setChosen] = useState(read);
  const mine = (id: string | null) => (id ? me.teams.find((t) => t.team.id === id) : undefined);
  const active = mine(teamFromPath(pathname)) ?? mine(chosen) ?? me.teams[0];
  const activeId = active?.team.id;

  useEffect(() => {
    if (activeId) write(activeId);
  }, [activeId]);

  return {
    active,
    choose: (teamId: string) => {
      setChosen(teamId);
      write(teamId);
    },
  };
}
