import type { PositionCode } from '@sdl/domain';

/** Datos de la maqueta (`/muestra`): el equipo demo, inventados para ver el diseño. */
export interface DemoPlayer {
  n: number;
  name: string;
  pos: PositionCode;
  media: number | null;
  assessed: boolean;
  tested: boolean;
}

export const DEMO_PLAYERS: DemoPlayer[] = [
  { n: 1, name: 'Julio César', pos: 'POR', media: 74, assessed: true, tested: true },
  { n: 2, name: 'Andrés Pineda', pos: 'LAT', media: 59, assessed: true, tested: true },
  { n: 3, name: 'Samuel Ortiz', pos: 'LAT', media: 66, assessed: true, tested: true },
  { n: 4, name: 'Cristian Mora', pos: 'DFC', media: 77, assessed: true, tested: true },
  { n: 5, name: 'Ronnie Vargas', pos: 'DFC', media: 71, assessed: true, tested: true },
  { n: 6, name: 'Felipe Arango', pos: 'MCD', media: 68, assessed: false, tested: false },
  { n: 7, name: 'Gabriel Bobadilla', pos: 'EXT', media: 79, assessed: true, tested: true },
  { n: 8, name: 'Julián Jiménez', pos: 'MC', media: 73, assessed: true, tested: true },
  { n: 9, name: 'Daniel Quintero', pos: 'DC', media: 75, assessed: true, tested: true },
  { n: 10, name: 'Mateo Rincón', pos: 'MP', media: 72, assessed: true, tested: true },
  { n: 11, name: 'Cristian Meza', pos: 'DC', media: 70, assessed: true, tested: true },
  { n: 12, name: 'Wilmer Castro', pos: 'POR', media: 69, assessed: false, tested: false },
  { n: 14, name: 'Brayan Salazar', pos: 'EXT', media: 76, assessed: false, tested: false },
  { n: 15, name: 'Óscar Lozano', pos: 'MC', media: null, assessed: false, tested: true },
];

export const DEMO_TEAMS = [
  {
    id: 'primer',
    name: 'Primer equipo',
    club: 'Los del Barrio',
    format: 'Fútbol 11',
    roles: 'Entrenador y jugador',
  },
  {
    id: 'jueves',
    name: 'Los del jueves',
    club: 'Los del Barrio',
    format: 'Fútbol 8',
    roles: 'Jugador',
  },
];
