import styles from './Segmented.module.css';

/**
 * Elegir una de pocas opciones que cambian lo que se ve ("Lista | Pizarra"). Botones con
 * `aria-pressed`: honesto con lo que hacen (no son pestañas con su panel).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.segmented}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
