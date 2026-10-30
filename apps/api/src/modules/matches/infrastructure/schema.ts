import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { matchFormat } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { lineup } from '../../lineups/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

export const matchStatus = pgEnum('match_status', ['scheduled', 'cancelled']);
/** Campeonato, amistoso o entrenamiento (2026-10-28, `02` §12). */
export const matchKind = pgEnum('match_kind', ['championship', 'friendly', 'training']);
export const matchReplyValue = pgEnum('match_reply_value', ['yes', 'no']);

/**
 * Un torneo del equipo (2026-10-28, `03` · tournament): los partidos de campeonato son de uno.
 * Más adelante se le cuelgan los cobros (la inscripción), la tabla y "Mi torneo". El nombre no se
 * repite en el equipo (sin importar mayúsculas).
 */
export const tournament = pgTable(
  'tournament',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    name: text().notNull(),
    createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tournament_team_name_unique').on(t.teamId, sql`lower(${t.name})`)],
);

/** Un partido convocado (Fase 7, `03` · team_match). */
export const teamMatch = pgTable(
  'team_match',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    kind: matchKind().notNull(),
    /** El torneo, solo en los de campeonato; null en los de antes del 2026-10-28 hasta asignarlo. */
    tournamentId: uuid().references(() => tournament.id),
    format: matchFormat().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    place: text().notNull(),
    /** null solo en los entrenamientos. */
    opponent: text(),
    status: matchStatus().notNull().default('scheduled'),
    /** La alineación publicada para el equipo (PR 3 de la Fase 7). */
    lineupId: uuid().references(() => lineup.id, { onDelete: 'set null' }),
    publishedAt: timestamp({ withTimezone: true }),
    /** Después del partido (D18): el resultado y la figura, desde la hora del partido. */
    goalsFor: smallint(),
    goalsAgainst: smallint(),
    figurePlayerId: uuid().references(() => user.id, { onDelete: 'set null' }),
    resultAt: timestamp({ withTimezone: true }),
    /** "¿Quién vino?" (2026-10-30): desde cuándo hay lista; null = cuentan los que dijeron voy. */
    attendanceTakenAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index().on(t.teamId, t.startsAt),
    // Entreno: sin rival, sin torneo y sin resultado; partido: con rival; torneo solo en campeonato.
    check(
      'team_match_kind_fields',
      sql`(${t.kind} = 'training') = (${t.opponent} is null)
        and (${t.tournamentId} is null or ${t.kind} = 'championship')
        and (${t.kind} <> 'training' or ${t.goalsFor} is null)`,
    ),
    check(
      'team_match_goals_range',
      sql`${t.goalsFor} between 0 and 99 and ${t.goalsAgainst} between 0 and 99`,
    ),
  ],
);

/** La respuesta de cada jugador: voy / no voy. Cambia hasta la hora del partido. */
export const matchReply = pgTable(
  'match_reply',
  {
    matchId: uuid()
      .notNull()
      .references(() => teamMatch.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reply: matchReplyValue().notNull(),
    repliedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] })],
);

/**
 * "¿Quién vino?" (2026-10-30, `02` §13): la lista que pasa el cuerpo técnico desde la hora del
 * partido. Se reemplaza entera al guardarla; manda en las evaluaciones y en los cobros.
 */
export const matchAttendance = pgTable(
  'match_attendance',
  {
    matchId: uuid()
      .notNull()
      .references(() => teamMatch.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    markedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    markedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] })],
);

/**
 * La evaluación de un jugador en un partido (D18): 1 Flojo a 5 Figura, una por jugador; quien
 * la corrige la reemplaza. La nota es del cuerpo técnico.
 */
export const matchRating = pgTable(
  'match_rating',
  {
    matchId: uuid()
      .notNull()
      .references(() => teamMatch.id, { onDelete: 'cascade' }),
    playerUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: smallint().notNull(),
    note: text(),
    ratedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    ratedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerUserId] }),
    index().on(t.playerUserId),
    check('match_rating_range', sql`${t.rating} between 1 and 5`),
  ],
);
