import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { matchFormat } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

export const lineupMode = pgEnum('lineup_mode', ['balanced', 'performance', 'development']);
export const lineupPriority = pgEnum('lineup_priority', ['none', 'defensa', 'ataque']);

/**
 * Una alineación guardada (docs/03-modelo-datos.md · lineup). Se arma en el celular; aquí
 * queda la foto completa: si mañana cambian tarjetas o exámenes, sigue explicando por qué
 * se eligió así.
 */
export const lineup = pgTable(
  'lineup',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    name: text().notNull(),
    matchDate: date(),
    format: matchFormat().notNull(),
    formation: text().notNull(),
    mode: lineupMode().notNull(),
    weights: jsonb().$type<Record<'A' | 'V' | 'C' | 'R', number>>().notNull(),
    priority: lineupPriority().notNull().default('none'),
    minKnowledgePct: numeric({ precision: 4, scale: 3, mode: 'number' }),
    fitVersion: text().notNull(),
    available: uuid().array().notNull(),
    pins: jsonb().$type<{ slotId: string; playerId: string }[]>().notNull(),
    assignments: jsonb()
      .$type<
        {
          slotId: string;
          playerId: string | null;
          fit: number | null;
          breakdown: Partial<Record<'A' | 'V' | 'C' | 'R', number>> | null;
          pinned: boolean;
          manual: boolean;
        }[]
      >()
      .notNull(),
    bench: uuid().array().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.teamId, t.updatedAt.desc())],
);
