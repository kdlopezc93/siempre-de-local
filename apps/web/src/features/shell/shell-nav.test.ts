import { describe, expect, it } from 'vitest';

import {
  activeTab,
  formatsLabel,
  rolesLabel,
  switchTarget,
  tabsFor,
  teamFromPath,
} from './shell-nav';

const ids = (roles: Parameters<typeof tabsFor>[1]) => tabsFor('t1', roles).map((t) => t.id);

describe('navegación por rol (07 §4.2)', () => {
  it('pestañas según el rol en el equipo', () => {
    expect(ids(['player'])).toEqual(['inicio', 'partidos', 'mi-juego', 'equipo']);
    expect(ids(['assistant'])).toEqual(['inicio', 'plantilla', 'partidos', 'equipo']);
    expect(ids(['coach', 'player'])).toEqual([
      'inicio',
      'plantilla',
      'partidos',
      'mi-juego',
      'equipo',
    ]);
  });

  it('la pestaña activa cubre sus pantallas internas', () => {
    const tabs = tabsFor('t1', ['coach', 'player']);
    const at = (path: string) => activeTab(path, tabs)?.id;
    expect(at('/')).toBe('inicio');
    expect(at('/equipos/t1/plantilla/p9/tarjeta')).toBe('plantilla');
    expect(at('/equipos/t1/planificador')).toBe('partidos');
    expect(at('/equipos/t1/partidos/m1')).toBe('partidos');
    expect(at('/conocimiento')).toBe('mi-juego');
    expect(at('/equipos/t1/validacion')).toBe('equipo');
    // Ni "/" como prefijo de todo ni otro equipo.
    expect(at('/equipos/t2/plantilla')).toBeUndefined();
    expect(at('/plantillas')).toBeUndefined();
  });

  it('al cambiar de equipo: la misma pestaña si existe allá; si no, el inicio', () => {
    expect(switchTarget('plantilla', tabsFor('t2', ['coach']))).toBe('/equipos/t2/plantilla');
    expect(switchTarget('plantilla', tabsFor('t2', ['player']))).toBe('/');
    expect(switchTarget(undefined, tabsFor('t2', ['player']))).toBe('/');
  });

  it('el equipo de la URL y los roles en palabras', () => {
    expect(teamFromPath('/equipos/abc/plantilla')).toBe('abc');
    expect(teamFromPath('/conocimiento')).toBeNull();
    expect(rolesLabel(['coach', 'player'])).toBe('Entrenador y jugador');
    expect(rolesLabel(['player'])).toBe('Jugador');
  });

  it('los formatos en palabras, el principal primero', () => {
    expect(formatsLabel(['F11'], 'F11')).toBe('Fútbol 11');
    expect(formatsLabel(['F11', 'F8'], 'F8')).toBe('Fútbol 8 y 11');
    expect(formatsLabel(['F11', 'F8', 'F5'], 'F5')).toBe('Fútbol 5, 11 y 8');
  });
});
