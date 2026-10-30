import type { InvitationRole } from '@sdl/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
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
/** `treasurer` (2026-10-30): maneja los cobros y pasa lista; no arma alineaciones ni evalúa. */
export const teamRole = pgEnum('team_role', ['coach', 'assistant', 'player', 'treasurer']);

export const club = pgTable('club', {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  /** Ciudad o barrio (2026-10-29): todos sus equipos son de ahí. Null en los de antes. */
  city: text(),
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
    /** El formato principal (D14): el del test, la valoración y la tarjeta. */
    format: matchFormat().notNull(),
    /** Los formatos en que juega (el principal entre ellos); el planificador elige por partido. */
    formats: matchFormat().array().notNull(),
    season: text().notNull(),
    /** Categoría, libre (2026-10-29): "Libre", "Veteranos", "Femenino"… Null en los de antes. */
    category: text(),
    /** ¿El jugador ve su tarjeta 0–99? (D8) */
    ratingsVisibleToPlayers: boolean().notNull().default(true),
    /** ¿El jugador ve su evaluación de cada partido? (D18) */
    matchRatingsVisibleToPlayers: boolean().notNull().default(true),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.clubId, t.name, t.season),
    check('team_format_in_formats', sql`${t.format} = any(${t.formats})`),
  ],
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
    /**
     * Lesionado (solo en la fila de jugador): desde cuándo lo marcó el cuerpo técnico y,
     * opcional, cuándo se espera que vuelva. Sin nota: no se guarda qué tiene (dato de salud).
     */
    injuredAt: timestamp({ withTimezone: true }),
    injuryReturnOn: date({ mode: 'string' }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId, t.role] }), index().on(t.userId)],
);

export const invitation = pgTable(
  'invitation',
  {
    id: id(),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    // Con invitación no se entra de tesorero: ese rol se nombra en Roles (2026-10-30).
    role: teamRole().notNull().$type<InvitationRole>(),
    /** Cuerpo técnico que también juega: al aceptar entra además como jugador (2026-10-29). */
    alsoPlays: boolean().notNull().default(false),
    /** SHA-256 del código; el código en claro no se guarda (se muestra una vez). */
    codeHash: text().notNull().unique(),
    /** Null si se borró la cuenta de quien la creó (derecho de supresión, 04 §5). */
    createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    maxUses: smallint().notNull(),
    usedCount: smallint().notNull().default(0),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.teamId),
    check('invitation_uses_in_range', sql`${t.usedCount} >= 0 and ${t.usedCount} <= ${t.maxUses}`),
  ],
);

/**
 * Código de alta de un club (2026-10-29): lo genera el administrador de la plataforma y sirve
 * para crear un club desde la app. Un uso; el código en claro no se guarda.
 */
export const clubSignupCode = pgTable('club_signup_code', {
  id: id(),
  codeHash: text().notNull().unique(),
  /** Para quién es, para reconocerlo en la lista. */
  note: text(),
  createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  /** El club que se creó con él (lo llena "Crear mi club"). */
  clubId: uuid().references(() => club.id),
  usedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
  usedAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});
