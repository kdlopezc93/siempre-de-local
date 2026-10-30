import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from '../../identity/infrastructure/schema.js';
import { teamMatch, tournament } from '../../matches/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

/** Inscripción, arbitraje, vaca, cuota, multa, uniforme u otro (2026-10-30, `02` §15). */
export const chargeKind = pgEnum('charge_kind', [
  'registration',
  'referee',
  'vaca',
  'fee',
  'fine',
  'uniform',
  'other',
]);
export const chargeSplit = pgEnum('charge_split', ['per_person', 'total']);
export const paymentMethod = pgEnum('payment_method', [
  'cash',
  'nequi',
  'daviplata',
  'transfer',
  'other',
]);
export const paymentStatus = pgEnum('payment_status', ['reported', 'confirmed', 'rejected']);

/**
 * Un cobro del equipo (`03` · charge): de un partido, de un torneo o suelto. La plata va en pesos
 * enteros; `amount` es el valor por persona o el total que se repartió (`split`). Se anula, no se
 * borra.
 */
export const charge = pgTable(
  'charge',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    kind: chargeKind().notNull(),
    title: text(),
    matchId: uuid().references(() => teamMatch.id),
    tournamentId: uuid().references(() => tournament.id),
    split: chargeSplit().notNull(),
    amount: integer().notNull(),
    dueOn: date({ mode: 'string' }),
    createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index().on(t.teamId, t.createdAt),
    check('charge_amount_range', sql`${t.amount} between 1 and 100000000`),
    check('charge_match_or_tournament', sql`${t.matchId} is null or ${t.tournamentId} is null`),
  ],
);

/** Lo que debe cada uno en un cobro; el ajuste por persona es cambiar `amount`. */
export const chargeShare = pgTable(
  'charge_share',
  {
    chargeId: uuid()
      .notNull()
      .references(() => charge.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amount: integer().notNull(),
    note: text(),
  },
  (t) => [
    primaryKey({ columns: [t.chargeId, t.userId] }),
    index().on(t.userId),
    check('charge_share_amount_range', sql`${t.amount} between 0 and 100000000`),
  ],
);

/**
 * Un pago (o abono) de la parte de alguien. El que registra el tesorero queda confirmado; el
 * "Ya pagué" del jugador queda reportado hasta que lo confirmen o lo rechacen.
 */
export const payment = pgTable(
  'payment',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    chargeId: uuid().notNull(),
    userId: uuid().notNull(),
    amount: integer().notNull(),
    method: paymentMethod().notNull(),
    paidOn: date({ mode: 'string' }).notNull(),
    status: paymentStatus().notNull(),
    reportedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    reviewedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.chargeId, t.userId],
      foreignColumns: [chargeShare.chargeId, chargeShare.userId],
    }).onDelete('cascade'),
    index().on(t.chargeId),
    check('payment_amount_range', sql`${t.amount} between 1 and 100000000`),
  ],
);
