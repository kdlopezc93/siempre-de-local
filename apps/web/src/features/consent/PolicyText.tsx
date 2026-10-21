import policy from '../../../../../docs/legal/politica-tratamiento-datos.md?raw';
import { inline, parsePolicy } from './policy-markdown';
import styles from './PolicyText.module.css';

// Se parsea una vez al cargar el módulo: el texto no cambia sin una build nueva.
const BLOCKS = parsePolicy(policy).filter(
  (block) => !(block.kind === 'heading' && block.level === 1),
);

/** Texto completo de la política vigente (docs/legal/politica-tratamiento-datos.md). */
export function PolicyText() {
  return (
    <div className={styles.policy}>
      {BLOCKS.map((block, i) => {
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
