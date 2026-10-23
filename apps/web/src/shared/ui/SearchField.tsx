import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';

import styles from './SearchField.module.css';

/** Buscador redondo con lupa; la X lo limpia. */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        <MagnifyingGlass size={20} aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          name="q"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {value && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Borrar la búsqueda"
          onClick={() => onChange('')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
