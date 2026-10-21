import { Fragment, type ReactNode } from 'react';

/**
 * Markdown mínimo para la política de datos (docs/legal/): títulos `#`/`##`, párrafos,
 * listas `-` y `1.`, y **negrita**. Las citas `>` son notas para el equipo y no se muestran.
 * Suficiente para un texto que controlamos; no es un parser general.
 */
export type PolicyBlock =
  | { kind: 'heading'; level: 1 | 2; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

export function parsePolicy(markdown: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    const listItem = /^(-|\d+\.)\s+(.*)$/.exec(line);

    if (!line || line.startsWith('>') || line === '---') {
      flush();
    } else if (line.startsWith('#')) {
      flush();
      const [, hashes = '', text = ''] = /^(#+)\s+(.*)$/.exec(line) ?? [];
      blocks.push({ kind: 'heading', level: hashes.length === 1 ? 1 : 2, text });
    } else if (listItem) {
      flush();
      const ordered = listItem[1] !== '-';
      const last = blocks.at(-1);
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(listItem[2]!);
      else blocks.push({ kind: 'list', ordered, items: [listItem[2]!] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** `**negrita**` → <strong>. */
export function inline(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}
