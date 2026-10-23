import styles from './SectionTabs.module.css';

/**
 * Secciones de una pantalla larga ("Resumen · Tarjeta · Conocimiento"): subrayadas en ámbar,
 * se deslizan de lado si no caben. Botones con `aria-pressed`; quien las usa guarda la
 * elegida en la URL.
 */
export function SectionTabs<T extends string>({
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
    <div role="group" aria-label={label} className={styles.tabs}>
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
