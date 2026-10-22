import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { matchFormat, positionCode } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

/**
 * Resultados del prototipo importados por CSV (02 §12): sin respuestas crudas, fuera de la
 * validación y del planificador. Se ligan a un jugador si su nombre coincide con uno solo.
 */
export const legacyResult = pgTable(
  'legacy_result',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    importedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    importedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    playerName: text().notNull(),
    playerUserId: uuid().references(() => user.id, { onDelete: 'set null' }),
    /** Hora local del celular, sin zona: así venía en el CSV. */
    takenAt: timestamp({ mode: 'string' }),
    format: matchFormat(),
    winner: positionCode().notNull(),
    affinityPct: smallint(),
    podium: positionCode().array().notNull(),
    prepScore: smallint(),
    prepTotal: smallint(),
    raw: jsonb().$type<Record<string, string>>().notNull(),
  },
  (t) => [
    // Como el prototipo: nombre + fecha + posición identifican un resultado (sin repetidos).
    unique().on(t.teamId, t.playerName, t.takenAt, t.winner).nullsNotDistinct(),
    index().on(t.teamId, t.importedAt.desc()),
  ],
);
