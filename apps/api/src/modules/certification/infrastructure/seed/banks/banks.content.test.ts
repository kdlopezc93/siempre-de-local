import { lintBank } from '@sdl/domain';
import { describe, expect, it } from 'vitest';

import { bankConfig } from '../publish-cert-bank.js';
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
