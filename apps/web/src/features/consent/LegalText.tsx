import { useMemo } from 'react';

import { inline, parsePolicy } from './policy-markdown';
import styles from './PolicyText.module.css';

/** Un texto legal de docs/legal en pantalla, sin su título (la pantalla ya lo tiene). */
export function LegalText({ markdown }: { markdown: string }) {
  // El texto no cambia sin una build nueva: se parsea una vez.
  const blocks = useMemo(
    () => parsePolicy(markdown).filter((block) => !(block.kind === 'heading' && block.level === 1)),
    [markdown],
  );
  return (
    <div className={styles.policy}>
      {blocks.map((block, i) => {
        if (block.kind === 'heading') return <h3 key={i}>{block.text}</h3>;
        if (block.kind === 'paragraph') return <p key={i}>{inline(block.text)}</p>;
        const List = block.ordered ? 'ol' : 'ul';
        return (
          <List key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
