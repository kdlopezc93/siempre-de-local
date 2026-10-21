import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { matchFormat } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';

/** Clubs, equipos y membresías (docs/03-modelo-datos.md §3). */
const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const clubRole = pgEnum('club_role', ['owner', 'admin']);
export const teamRole = pgEnum('team_role', ['coach', 'assistant', 'player']);

export const club = pgTable('club', {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  createdAt: createdAt(),
});

export const clubMembership = pgTable(
  'club_membership',
  {
    clubId: uuid()
      .notNull()
      .references(() => club.id),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: clubRole().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.userId] }), index().on(t.userId)],
);

export const team = pgTable(
  'team',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => club.id),
    name: text().notNull(),
    format: matchFormat().notNull(),
    season: text().notNull(),
    /** ¿El jugador ve su tarjeta 0–99? (D8) */
    ratingsVisibleToPlayers: boolean().notNull().default(true),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.clubId, t.name, t.season)],
);

export const teamMembership = pgTable(
  'team_membership',
  {
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: teamRole().notNull(),
    jerseyNumber: smallint(),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Salida del equipo; la fila se conserva para el historial. */
    leftAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId, t.role] }), index().on(t.userId)],
);
