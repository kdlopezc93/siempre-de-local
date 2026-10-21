import type { AttemptResult } from '@sdl/contracts';

/** Bandas de preparación (02 §5), dichas para el jugador. */
export const PREP_BAND: Record<AttemptResult['prep']['band'], string> = {
  very_prepared: 'Muy preparado',
  good: 'Buena base',
  reinforce: 'Reforzar fundamentos',
  room_to_grow: 'Terreno para crecer',
};

export const CONTEXT = { situation: 'Situación de juego', attribute: 'Tus cualidades' } as const;

export const FORMAT = { F8: 'fútbol 8', F11: 'fútbol 11' } as const;
