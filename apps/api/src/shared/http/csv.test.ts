import { describe, expect, it } from 'vitest';

import { BOM, toCsv } from './csv.js';

describe('toCsv', () => {
  it('lleva BOM, comillas escapadas y CRLF', () => {
    expect(
      toCsv([
        ['Nombre', 'Notas'],
        ['Pérez, "el Flaco"', ''],
      ]),
    ).toBe(BOM + '"Nombre","Notas"\r\n"Pérez, ""el Flaco""",""\r\n');
  });

  it('neutraliza fórmulas al inicio de una celda', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)', 'normal']])).toBe(
      BOM + '"\'=HYPERLINK(""x"")","\'+1","\'-2","\'@SUM(A1)","normal"\r\n',
    );
  });
});
