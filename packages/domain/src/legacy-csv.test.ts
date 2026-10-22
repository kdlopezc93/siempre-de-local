import { describe, expect, it } from 'vitest';

import { parseLegacyCsv, positionFromName } from './legacy-csv.js';

const BOM = String.fromCharCode(0xfeff);

// Tal como lo descarga detector-posicion.jsx: BOM, todo entre comillas.
const DETECTOR = `${BOM}"Nombre","Fecha","Formato","Posicion","Afinidad_%","Podio","Preparacion","Preparacion_%"
"Julián Jiménez","2026-05-10 14:32","Fútbol F11","Mediocentro","88","Mediocentro (88%) | Pivote (75%) | Mediapunta (70%)","7/8","88"`;

// El consolidado de panel-resultados.jsx: otro orden de columnas.
const PANEL = `"Nombre","Fecha","Formato","Posicion","Afinidad_%","Preparacion","Preparacion_%","Podio"
"Cristian Mora","2026-05-11 09:00","Fútbol F8","Defensa central","75","6/8","75","Defensa central (75%) | Lateral (60%) | Mediocentro (55%)"
"Ronnie","2026-05-11 09:05","Fútbol F8","Delantero","","","",""`;

describe('parseLegacyCsv', () => {
  it('lee el CSV del test del prototipo', () => {
    const { rows, rejected } = parseLegacyCsv(DETECTOR);
    expect(rejected).toEqual([]);
    expect(rows).toEqual([
      expect.objectContaining({
        line: 2,
        playerName: 'Julián Jiménez',
        takenAt: '2026-05-10T14:32',
        format: 'F11',
        winner: 'MC',
        affinityPct: 88,
        podium: ['MC', 'MCD', 'MP'],
        prepScore: 7,
        prepTotal: 8,
      }),
    ]);
    expect(rows[0]!.raw['Posicion']).toBe('Mediocentro');
  });

  it('lee el consolidado del panel y rechaza filas sin posición válida, con su línea', () => {
    const { rows, rejected } = parseLegacyCsv(PANEL);
    expect(rows.map((r) => [r.playerName, r.format, r.winner, r.prepScore])).toEqual([
      ['Cristian Mora', 'F8', 'DFC', 6],
    ]);
    expect(rejected).toEqual([{ line: 3, reason: 'Posición desconocida: "Delantero"' }]);
  });

  it('acepta varios CSV pegados uno tras otro (salta los encabezados repetidos)', () => {
    const { rows, rejected } = parseLegacyCsv(`${DETECTOR}\n${DETECTOR.replace(BOM, '')}`);
    expect(rows).toHaveLength(2);
    expect(rejected).toEqual([]);
  });

  it('tolera punto y coma, encabezados en minúscula sin tildes y celdas con comas o comillas', () => {
    const csv = 'nombre;posición;afinidad %\n"Pérez, ""el Flaco""";defensa central (DC);61\n';
    const { rows } = parseLegacyCsv(csv);
    expect(rows[0]).toMatchObject({
      playerName: 'Pérez, "el Flaco"',
      winner: 'DFC',
      affinityPct: 61,
      takenAt: null,
      format: null,
      podium: ['DFC'],
    });
  });

  it('sin las columnas Nombre y Posicion no lee nada', () => {
    expect(parseLegacyCsv('a,b\n1,2').rejected).toEqual([
      { line: 1, reason: 'Faltan las columnas Nombre y Posicion' },
    ]);
  });

  it('reconoce posiciones por nombre o sigla', () => {
    expect(positionFromName('Pivote')).toBe('MCD');
    expect(positionFromName(' delantero CENTRO ')).toBe('DC');
    expect(positionFromName('Mediocentro (CM)')).toBe('MC');
    expect(positionFromName('EXT')).toBe('EXT');
    expect(positionFromName('Volante')).toBeNull();
  });
});
