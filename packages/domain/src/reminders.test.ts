import { describe, expect, it } from 'vitest';

import {
  dueReminder,
  isQuietHour,
  manualReminderBlockedUntil,
  reminderTimes,
  upcomingReminders,
} from './reminders.js';

/** Una hora de Colombia (UTC−5) como instante. */
const co = (local: string) => new Date(`${local}:00-05:00`);

describe('reminderTimes', () => {
  it('domingo 3 p. m., convocado el miércoles: sábado 7 p. m. y domingo 12 m.', () => {
    expect(
      reminderTimes({ startsAt: co('2026-11-08T15:00'), createdAt: co('2026-11-04T20:10') }),
    ).toEqual({ eve: co('2026-11-07T19:00'), soon: co('2026-11-08T12:00') });
  });

  it('convocado con menos de un día: solo el de 3 horas antes', () => {
    expect(
      reminderTimes({ startsAt: co('2026-11-08T15:00'), createdAt: co('2026-11-07T21:30') }),
    ).toEqual({ eve: null, soon: co('2026-11-08T12:00') });
  });

  it('convocado hace menos de 3 horas: ninguno', () => {
    expect(
      reminderTimes({ startsAt: co('2026-11-08T15:00'), createdAt: co('2026-11-08T13:00') }),
    ).toEqual({ eve: null, soon: null });
  });

  it('partido a las 8 a. m.: el de 3 horas antes sale a las 7 a. m.', () => {
    expect(
      reminderTimes({ startsAt: co('2026-11-08T08:00'), createdAt: co('2026-11-01T10:00') }).soon,
    ).toEqual(co('2026-11-08T07:00'));
  });

  it('partido a las 7 a. m.: el de 3 horas antes sale la noche anterior a las 8:30', () => {
    const t = reminderTimes({
      startsAt: co('2026-11-08T07:00'),
      createdAt: co('2026-11-01T10:00'),
    });
    expect(t.soon).toEqual(co('2026-11-07T20:30'));
    // El de la noche antes quedaría pegado: no va.
    expect(t.eve).toBeNull();
  });

  it('partido a las 11:30 p. m.: el de 3 horas antes sale a las 8:30 p. m.', () => {
    expect(
      reminderTimes({ startsAt: co('2026-11-08T23:30'), createdAt: co('2026-11-01T10:00') }).soon,
    ).toEqual(co('2026-11-08T20:30'));
  });
});

describe('dueReminder', () => {
  const base = {
    startsAt: co('2026-11-08T15:00'),
    createdAt: co('2026-11-04T20:10'),
    eveSentAt: null,
    soonSentAt: null,
  };

  it('nada antes de la hora, el de la noche antes desde las 7 p. m.', () => {
    expect(dueReminder(base, co('2026-11-07T18:35'))).toBeNull();
    expect(dueReminder(base, co('2026-11-07T19:05'))).toBe('eve');
  });

  it('nunca de noche, ni dos veces', () => {
    expect(dueReminder(base, co('2026-11-07T21:05'))).toBeNull();
    expect(dueReminder(base, co('2026-11-08T06:35'))).toBeNull();
    expect(
      dueReminder({ ...base, eveSentAt: co('2026-11-07T19:05') }, co('2026-11-08T07:05')),
    ).toBeNull();
  });

  it('si se pasó la hora del de la noche (la tarea no corrió), sale en la mañana', () => {
    expect(dueReminder(base, co('2026-11-08T07:05'))).toBe('eve');
  });

  it('el de 3 horas antes; si ya salió ese, el de la noche ya no', () => {
    const sent = { ...base, eveSentAt: co('2026-11-07T19:05') };
    expect(dueReminder(sent, co('2026-11-08T12:05'))).toBe('soon');
    expect(dueReminder(base, co('2026-11-08T12:05'))).toBe('soon');
    expect(
      dueReminder({ ...sent, soonSentAt: co('2026-11-08T12:05') }, co('2026-11-08T13:00')),
    ).toBeNull();
  });

  it('nada desde la hora del partido', () => {
    expect(dueReminder(base, co('2026-11-08T15:00'))).toBeNull();
  });
});

describe('upcomingReminders y el botón', () => {
  it('los que faltan', () => {
    const m = {
      startsAt: co('2026-11-08T15:00'),
      createdAt: co('2026-11-04T20:10'),
      eveSentAt: null,
      soonSentAt: null,
    };
    expect(upcomingReminders(m, co('2026-11-06T10:00'))).toEqual([
      co('2026-11-07T19:00'),
      co('2026-11-08T12:00'),
    ]);
    expect(
      upcomingReminders({ ...m, eveSentAt: co('2026-11-07T19:05') }, co('2026-11-07T20:00')),
    ).toEqual([co('2026-11-08T12:00')]);
  });

  it('a mano, una vez cada 2 horas', () => {
    expect(manualReminderBlockedUntil(null, co('2026-11-08T10:00'))).toBeNull();
    expect(manualReminderBlockedUntil(co('2026-11-08T09:00'), co('2026-11-08T10:00'))).toEqual(
      co('2026-11-08T11:00'),
    );
    expect(manualReminderBlockedUntil(co('2026-11-08T07:00'), co('2026-11-08T10:00'))).toBeNull();
  });

  it('las horas de silencio', () => {
    expect(isQuietHour(co('2026-11-08T20:59'))).toBe(false);
    expect(isQuietHour(co('2026-11-08T21:00'))).toBe(true);
    expect(isQuietHour(co('2026-11-08T06:59'))).toBe(true);
    expect(isQuietHour(co('2026-11-08T07:00'))).toBe(false);
  });
});
