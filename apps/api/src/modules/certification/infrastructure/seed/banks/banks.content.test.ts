import { lintBank } from '@sdl/domain';
import { describe, expect, it } from 'vitest';

import { bankConfig } from '../publish-cert-bank.js';
import { qb } from './authoring.js';
import { CERT_BANKS } from './index.js';

/**
 * Control de calidad en la CI (02 §6.5): ningún banco del repo puede estar mal armado, y
 * uno revisado tiene que poder publicarse (sin errores de lint).
 */
const STRUCTURE = new Set([
  'duplicate-code',
  'duplicate-text',
  'unknown-area',
  'difficulty',
  'empty-text',
  'empty-explanation',
  'four-options',
  'one-correct',
  'duplicate-option',
  'empty-option',
  'board',
]);

describe('bancos del examen en el repo', () => {
  it('no hay dos versiones con la misma posición y etiqueta', () => {
    const keys = CERT_BANKS.map((b) => `${b.position} ${b.label}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const bank of CERT_BANKS) {
    describe(`${bank.position} ${bank.label}`, () => {
      const errors = lintBank(bank, bankConfig(bank)).filter((i) => i.level === 'error');

      it('está bien armado (aunque sea borrador)', () => {
        expect(errors.filter((e) => STRUCTURE.has(e.rule))).toEqual([]);
      });

      if (bank.review) {
        it('revisado: se puede publicar', () => {
          expect(errors).toEqual([]);
        });
      }
    });
  }
});

describe('qb: preguntas de pizarra', () => {
  it('cada punto queda en el lugar de su opción, con la correcta donde caiga', () => {
    const spot = (x: number) => ({ x, y: 110 });
    const item = qb(
      'DFC-PIZ-01',
      'marcaje',
      2,
      '¿Dónde te paras?',
      { view: 'own-half', pieces: [] },
      { label: 'Correcta', spot: spot(10) },
      [
        { label: 'Mal 1', spot: spot(30) },
        { label: 'Mal 2', spot: spot(50) },
        { label: 'Mal 3', spot: spot(70) },
      ],
      'Porque sí.',
    );
    const byLabel = new Map(item.options.map((o, i) => [o.label, item.board!.spots![i]!.x]));
    expect(Object.fromEntries(byLabel)).toEqual({
      Correcta: 10,
      'Mal 1': 30,
      'Mal 2': 50,
      'Mal 3': 70,
    });
    expect(item.options.filter((o) => o.correct)).toEqual([{ label: 'Correcta', correct: true }]);
  });
});
