import type { PositionCode } from './positions.js';

/**
 * Versión de la fórmula de medias por posición (02 §7.3). Los pesos viven aquí, no en la
 * BD; cambiarlos es una versión nueva.
 */
export const RATING_FORMULA_VERSION = 'rating-formula-v1';

export const OUTFIELD_ATTRIBUTES = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const;
export const GOALKEEPER_ATTRIBUTES = [
  'GK_DIV',
  'GK_HAN',
  'GK_KIC',
  'GK_REF',
  'GK_SPD',
  'GK_POS',
] as const;
export const RATING_ATTRIBUTE_CODES = [...OUTFIELD_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES] as const;

export type RatingAttributeCode = (typeof RATING_ATTRIBUTE_CODES)[number];
export type RatingValues = Readonly<Partial<Record<RatingAttributeCode, number>>>;

/** Catálogo (03 §7): se siembra en `rating_attribute`. */
export const RATING_ATTRIBUTES: Readonly<
  Record<RatingAttributeCode, { name: string; short: string; group: 'outfield' | 'goalkeeper' }>
> = {
  PAC: { name: 'Ritmo', short: 'RIT', group: 'outfield' },
  SHO: { name: 'Tiro', short: 'TIR', group: 'outfield' },
  PAS: { name: 'Pase', short: 'PAS', group: 'outfield' },
  DRI: { name: 'Regate', short: 'REG', group: 'outfield' },
  DEF: { name: 'Defensa', short: 'DEF', group: 'outfield' },
  PHY: { name: 'Físico', short: 'FIS', group: 'outfield' },
  GK_DIV: { name: 'Estirada', short: 'EST', group: 'goalkeeper' },
  GK_HAN: { name: 'Manejo', short: 'MAN', group: 'goalkeeper' },
  GK_KIC: { name: 'Saque', short: 'SAQ', group: 'goalkeeper' },
  GK_REF: { name: 'Reflejos', short: 'REF', group: 'goalkeeper' },
  GK_SPD: { name: 'Velocidad de reacción', short: 'VEL', group: 'goalkeeper' },
  GK_POS: { name: 'Colocación', short: 'COL', group: 'goalkeeper' },
};

/**
 * Anclas de la escala (02 §7.1), relativas a la categoría del equipo, no al fútbol
 * profesional. De la más alta a la más baja.
 */
export const RATING_ANCHORS: readonly { min: number; max: number; label: string }[] = [
  { min: 85, max: 99, label: 'Referencia en la categoría en este aspecto' },
  { min: 70, max: 84, label: 'Destaca claramente en el equipo' },
  { min: 55, max: 69, label: 'Nivel medio del equipo' },
  { min: 40, max: 54, label: 'Por debajo del nivel del equipo' },
  { min: 0, max: 39, label: 'Carencia importante' },
];

export function anchorFor(value: number) {
  return RATING_ANCHORS.find((anchor) => value >= anchor.min)!;
}

type Weights = Readonly<Partial<Record<RatingAttributeCode, number>>>;

/** Pesos v1 (02 §7.3). Cada fila suma 1. */
export const RATING_WEIGHTS_V1: Readonly<Record<PositionCode, Weights>> = {
  POR: { GK_DIV: 0.2, GK_HAN: 0.2, GK_REF: 0.25, GK_POS: 0.2, GK_KIC: 0.1, GK_SPD: 0.05 },
  LAT: { PAC: 0.25, PAS: 0.2, DRI: 0.1, DEF: 0.3, PHY: 0.15 },
  DFC: { PAC: 0.1, PAS: 0.15, DEF: 0.45, PHY: 0.3 },
  MCD: { PAS: 0.35, DRI: 0.1, DEF: 0.35, PHY: 0.2 },
  MC: { SHO: 0.15, PAS: 0.35, DRI: 0.15, DEF: 0.15, PHY: 0.2 },
  MP: { PAC: 0.1, SHO: 0.25, PAS: 0.35, DRI: 0.3 },
  EXT: { PAC: 0.35, SHO: 0.15, PAS: 0.15, DRI: 0.35 },
  DC: { PAC: 0.2, SHO: 0.45, DRI: 0.15, PHY: 0.2 },
};

export class InvalidRatingError extends Error {
  override readonly name = 'InvalidRatingError';
}

/**
 * Una foto válida: los 6 de campo siempre; los de portero, los 6 o ninguno. Enteros 0–99.
 */
export function assertValidRating(values: RatingValues): void {
  for (const [code, value] of Object.entries(values)) {
    if (!(code in RATING_ATTRIBUTES)) throw new InvalidRatingError(`Atributo desconocido: ${code}`);
    if (!Number.isInteger(value) || value! < 0 || value! > 99) {
      throw new InvalidRatingError(`${code} debe ser un entero de 0 a 99`);
    }
  }
  if (OUTFIELD_ATTRIBUTES.some((code) => values[code] === undefined)) {
    throw new InvalidRatingError('Faltan atributos de campo');
  }
  const gk = GOALKEEPER_ATTRIBUTES.filter((code) => values[code] !== undefined).length;
  if (gk !== 0 && gk !== GOALKEEPER_ATTRIBUTES.length) {
    throw new InvalidRatingError('Los atributos de portero van todos o ninguno');
  }
}

/**
 * Media por posición (MP) = Σ peso · valor, redondeada. Solo las posiciones cuyos
 * atributos están todos: sin los de portero, no hay MP de portero. Se calcula para las 8
 * posiciones; en F8 se usan MC y DC como en F11 (el plegado solo afecta al test).
 */
export function positionAverages(values: RatingValues): Partial<Record<PositionCode, number>> {
  const result: Partial<Record<PositionCode, number>> = {};
  for (const [pos, weights] of Object.entries(RATING_WEIGHTS_V1) as [PositionCode, Weights][]) {
    const entries = Object.entries(weights) as [RatingAttributeCode, number][];
    if (entries.some(([code]) => values[code] === undefined)) continue;
    result[pos] = Math.round(entries.reduce((sum, [code, w]) => sum + w * values[code]!, 0));
  }
  return result;
}
