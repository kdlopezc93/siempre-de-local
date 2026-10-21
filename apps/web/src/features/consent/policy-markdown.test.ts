import { POLICY_VERSION } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import policy from '../../../../../docs/legal/politica-tratamiento-datos.md?raw';
import { parsePolicy } from './policy-markdown';

describe('parsePolicy', () => {
  it('títulos, párrafos de varias líneas y listas; las notas `>` no se muestran', () => {
    const blocks = parsePolicy(
      [
        '# Título',
        '> Nota interna del equipo',
        '## 1. Sección',
        'Primera línea',
        'segunda línea.',
        '',
        '- uno',
        '- **dos**',
        '1. a',
        '---',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: 'Título' },
      { kind: 'heading', level: 2, text: '1. Sección' },
      { kind: 'paragraph', text: 'Primera línea segunda línea.' },
      { kind: 'list', ordered: false, items: ['uno', '**dos**'] },
      { kind: 'list', ordered: true, items: ['a'] },
    ]);
  });

  it('el texto que ve la persona es el de la versión que acepta', () => {
    expect(policy).toContain(`**Versión:** ${POLICY_VERSION}`);
    expect(
      parsePolicy(policy).some((b) => b.kind === 'paragraph' && b.text.includes('BORRADOR')),
    ).toBe(false);
  });
});
