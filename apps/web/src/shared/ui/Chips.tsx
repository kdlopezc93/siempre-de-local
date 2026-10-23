import styles from './Chips.module.css';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Filtros en fila que se deslizan de lado si no caben. Cada uno es un botón que se prende y
 * se apaga (`aria-pressed`); `single` deja uno solo prendido a la vez.
 */
export function Chips<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  selected: ReadonlySet<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.row}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={selected.has(o.value)}
          aria-label={o.count !== undefined ? `${o.label}, ${o.count}` : undefined}
          className={styles.chip}
          onClick={() => onToggle(o.value)}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={styles.count} aria-hidden="true">
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
