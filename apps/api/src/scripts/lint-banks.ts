import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { lintBank } from '@sdl/domain';

import { lintReport, reviewSheet } from '../modules/certification/application/bank-report.js';
import { CERT_BANKS } from '../modules/certification/infrastructure/seed/banks/index.js';
import { bankConfig } from '../modules/certification/infrastructure/seed/publish-cert-bank.js';

/**
 * pnpm bank:lint [-- --md <carpeta>]
 *
 * Control de calidad de los bancos del examen (02 §6.5). Con `--md`, escribe además la
 * hoja de revisión de cada banco para el entrenador revisor. Sale con error si un banco
 * revisado tiene errores (no se podría publicar).
 */
const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { md: { type: 'string' } },
});

let blocking = 0;
if (CERT_BANKS.length === 0) console.log('Todavía no hay bancos.');
for (const bank of CERT_BANKS) {
  const issues = lintBank(bank, bankConfig(bank));
  console.log(`${lintReport(bank, issues)}\n`);
  if (bank.review && issues.some((i) => i.level === 'error')) blocking++;
  if (values.md) {
    mkdirSync(values.md, { recursive: true });
    const file = `${values.md}/${bank.position}-${bank.label}.md`;
    writeFileSync(file, reviewSheet(bank, issues));
    console.log(`  Hoja de revisión: ${file}\n`);
  }
}
process.exitCode = blocking > 0 ? 1 : 0;
