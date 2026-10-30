import { POSITION_CODES } from '@sdl/domain';
import { pgEnum } from 'drizzle-orm/pg-core';

/** Tipos compartidos entre módulos (03 §1). Las posiciones salen del orden canónico del dominio. */
export const positionCode = pgEnum('position_code', POSITION_CODES);
export const matchFormat = pgEnum('match_format', ['F8', 'F11', 'F5']);
