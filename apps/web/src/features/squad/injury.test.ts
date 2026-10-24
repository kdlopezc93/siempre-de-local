import { describe, expect, it } from 'vitest';

import { injuryText, returnOverdue, todayIso } from './injury';

const since = '2026-10-24T12:00:00.000Z';

describe('lesionados', () => {
  it('la línea dice hasta cuándo, o que ya debía volver', () => {
    expect(injuryText({ since, returnOn: null }, '2026-10-24')).toBe('Lesionado');
    expect(injuryText({ since, returnOn: '2026-11-15' }, '2026-10-24')).toBe(
      'Lesionado, vuelve el 15 nov',
    );
    expect(injuryText({ since, returnOn: '2026-11-15' }, '2026-11-15')).toBe(
      'Lesionado, debía volver el 15 nov',
    );
  });

  it('toca confirmar desde el día de la vuelta', () => {
    expect(returnOverdue(null, '2026-11-15')).toBe(false);
    expect(returnOverdue({ since, returnOn: null }, '2026-11-15')).toBe(false);
    expect(returnOverdue({ since, returnOn: '2026-11-16' }, '2026-11-15')).toBe(false);
    expect(returnOverdue({ since, returnOn: '2026-11-15' }, '2026-11-15')).toBe(true);
  });

  it('hoy, en formato de fecha', () => {
    expect(todayIso(new Date(2026, 10, 15, 23, 30))).toBe('2026-11-15');
  });
});
