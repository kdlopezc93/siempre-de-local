/*
 * El recordatorio de la convocatoria (2026-11-06, Kevin aprobó la maqueta): a los que no han
 * respondido voy / no voy, la noche antes a las 7 p. m. y 3 horas antes; nunca entre las 9 p. m.
 * y las 7 a. m. (hora de Colombia, que no cambia de horario). El cuerpo técnico también puede
 * recordarles cuando quiera, una vez cada 2 horas.
 */

const HOUR = 3_600_000;
/** Colombia: UTC−5 todo el año. */
const OFFSET = -5 * HOUR;
export const REMINDER_EVE_HOUR = 19;
export const REMINDER_HOURS_BEFORE = 3;
/** Ni antes de las 7 a. m. ni desde las 9 p. m. */
export const QUIET_FROM = 21;
export const QUIET_UNTIL = 7;
/** Lo más tarde que sale uno que caería en la noche (la tarea corre cada media hora). */
const LAST_BEFORE_QUIET = { hour: 20, minute: 30 };
export const MANUAL_REMINDER_COOLDOWN_MS = 2 * HOUR;

export type ReminderStage = 'eve' | 'soon';

export interface ReminderState {
  startsAt: Date;
  /** Cuándo se convocó: el de la noche antes no sale si se convocó después. */
  createdAt: Date;
  eveSentAt: Date | null;
  soonSentAt: Date | null;
}

/** La hora local de un instante. */
const localHour = (at: Date) => new Date(at.getTime() + OFFSET).getUTCHours();

/** El instante de las `hour:minute` locales del día local de `day`, más `days` días. */
function atLocal(day: Date, hour: number, minute = 0, days = 0): Date {
  const local = new Date(day.getTime() + OFFSET);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, hour, minute) -
      OFFSET,
  );
}

/** ¿Es de noche (no se avisa)? */
export const isQuietHour = (at: Date): boolean => {
  const h = localHour(at);
  return h >= QUIET_FROM || h < QUIET_UNTIL;
};

/** Mueve a la mañana (o a la noche anterior) un recordatorio que cae de noche. */
function outOfQuiet(at: Date, startsAt: Date): Date {
  if (!isQuietHour(at)) return at;
  if (localHour(at) >= QUIET_FROM)
    return atLocal(at, LAST_BEFORE_QUIET.hour, LAST_BEFORE_QUIET.minute);
  const morning = atLocal(at, QUIET_UNTIL);
  return morning < startsAt
    ? morning
    : atLocal(at, LAST_BEFORE_QUIET.hour, LAST_BEFORE_QUIET.minute, -1);
}

/**
 * Cuándo van los dos recordatorios automáticos; null el que no aplica: el de la noche antes si
 * se convocó con menos de un día (o queda muy pegado al otro), el de 3 horas antes si se
 * convocó después.
 */
export function reminderTimes(m: Pick<ReminderState, 'startsAt' | 'createdAt'>): {
  eve: Date | null;
  soon: Date | null;
} {
  const soonAt = outOfQuiet(
    new Date(m.startsAt.getTime() - REMINDER_HOURS_BEFORE * HOUR),
    m.startsAt,
  );
  const soon = soonAt > m.createdAt && soonAt < m.startsAt ? soonAt : null;
  const eveAt = atLocal(m.startsAt, REMINDER_EVE_HOUR, 0, -1);
  const eve =
    eveAt > m.createdAt && (!soon || soon.getTime() - eveAt.getTime() >= 6 * HOUR) ? eveAt : null;
  return { eve, soon };
}

/** El recordatorio que toca mandar ya, o null. */
export function dueReminder(m: ReminderState, now: Date): ReminderStage | null {
  if (now >= m.startsAt || isQuietHour(now)) return null;
  const { eve, soon } = reminderTimes(m);
  if (soon && !m.soonSentAt && now >= soon) return 'soon';
  if (eve && !m.eveSentAt && !m.soonSentAt && now >= eve && (!soon || now < soon)) return 'eve';
  return null;
}

/** Los automáticos que faltan, para decirle al cuerpo técnico cuándo salen. */
export function upcomingReminders(m: ReminderState, now: Date): Date[] {
  const { eve, soon } = reminderTimes(m);
  return [
    ...(eve && !m.eveSentAt && !m.soonSentAt && eve > now ? [eve] : []),
    ...(soon && !m.soonSentAt && soon > now ? [soon] : []),
  ];
}

/** Desde cuándo se puede volver a recordar a mano; null si ya se puede. */
export function manualReminderBlockedUntil(lastManualAt: Date | null, now: Date): Date | null {
  if (!lastManualAt) return null;
  const until = new Date(lastManualAt.getTime() + MANUAL_REMINDER_COOLDOWN_MS);
  return until > now ? until : null;
}
