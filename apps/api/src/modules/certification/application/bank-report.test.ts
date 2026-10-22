import { DEFAULT_EXAM_CONFIG, lintBank } from '@sdl/domain';
import { describe, expect, it } from 'vitest';

import { certBankFixture } from '../../../test/cert-bank-fixture.js';
import { lintReport, reviewSheet } from './bank-report.js';

describe('informes del banco', () => {
  it('la hoja de revisión marca la correcta y lleva la explicación, por área', () => {
    const bank = certBankFixture(40, { review: null });
    const sheet = reviewSheet(bank, []);
    expect(sheet).toContain('# Banco de Defensa central (v1)');
    expect(sheet).toContain('**Borrador sin revisar.**');
    expect(sheet).toContain('## Juego aéreo');
    expect(sheet).toContain('### DFC-01 · fácil');
    expect(sheet).toContain('- [x] **Correcta 0**');
    expect(sheet).toContain('- [ ] Distractor A 0');
    expect(sheet).toContain('> Porque es lo que pide la posición.');
  });

  it('el resumen cuenta por área y dificultad y lista los hallazgos', () => {
    const bank = certBankFixture(30);
    const report = lintReport(bank, lintBank(bank, DEFAULT_EXAM_CONFIG));
    expect(report).toContain(
      'Defensa central v1: 30 ítems, revisado por Profe Revisor (2026-10-22)',
    );
    expect(report).toContain('  Marcaje: 10 (3/5/2)');
    expect(report).toContain('ERROR Tiene 30 ítems; se necesitan al menos 40 para publicar.');
  });
});
