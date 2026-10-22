import { POSITIONS, type LintIssue } from '@sdl/domain';

import type { CertBankContent } from './cert-bank.js';

const DIFFICULTY = { 1: 'fácil', 2: 'media', 3: 'difícil' } as const;

/** Resumen del lint para la terminal: cuántos ítems, por área y dificultad, y los hallazgos. */
export function lintReport(bank: CertBankContent, issues: readonly LintIssue[]): string {
  const name = `${POSITIONS[bank.position].name} ${bank.label}`;
  const lines = [
    `${name}: ${bank.items.length} ítems, ${bank.review ? `revisado por ${bank.review.by} (${bank.review.on})` : 'BORRADOR sin revisar'}`,
  ];
  for (const area of bank.areas) {
    const items = bank.items.filter((i) => i.area === area.code);
    const byDifficulty = ([1, 2, 3] as const).map(
      (d) => items.filter((i) => i.difficulty === d).length,
    );
    lines.push(`  ${area.name}: ${items.length} (${byDifficulty.join('/')})`);
  }
  for (const issue of issues) {
    lines.push(
      `  ${issue.level === 'error' ? 'ERROR' : 'aviso'} ${issue.item ? `${issue.item}: ` : ''}${issue.message}`,
    );
  }
  if (issues.length === 0) lines.push('  Sin hallazgos.');
  return lines.join('\n');
}

/**
 * Hoja de revisión para el entrenador revisor (D10): cada pregunta con sus opciones, la
 * correcta marcada y la explicación, agrupadas por área. Sale en Markdown para leerla en
 * GitHub o imprimirla.
 */
export function reviewSheet(bank: CertBankContent, issues: readonly LintIssue[]): string {
  const out = [
    `# Banco de ${POSITIONS[bank.position].name} (${bank.label})`,
    '',
    bank.review
      ? `Revisado por ${bank.review.by} el ${bank.review.on}.`
      : '**Borrador sin revisar.** Marca lo que cambiarías al lado de cada pregunta: la respuesta correcta, una opción que también podría valer, una explicación floja o una pregunta que sobra.',
    '',
    `${bank.items.length} preguntas. Cada examen toma 20, de todas las áreas y de las tres dificultades.`,
    '',
  ];
  if (issues.length > 0) {
    out.push('## Hallazgos del control de calidad', '');
    for (const issue of issues) {
      out.push(
        `- ${issue.level === 'error' ? '**Error**' : 'Aviso'}${issue.item ? ` (${issue.item})` : ''}: ${issue.message}`,
      );
    }
    out.push('');
  }
  for (const area of bank.areas) {
    out.push(`## ${area.name}`, '');
    for (const item of bank.items.filter((i) => i.area === area.code)) {
      out.push(`### ${item.code} · ${DIFFICULTY[item.difficulty]}`, '', item.text, '');
      for (const option of item.options) {
        out.push(option.correct ? `- [x] **${option.label}**` : `- [ ] ${option.label}`);
      }
      out.push('', `> ${item.explanation}`, '');
    }
  }
  return out.join('\n');
}
