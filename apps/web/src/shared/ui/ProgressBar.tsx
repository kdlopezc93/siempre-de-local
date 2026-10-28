import styles from './ProgressBar.module.css';

/**
 * Barra de avance con su etiqueta y su valor (Precisión de pases 88 %). La barra se llena con
 * scaleX; el valor va en Space Grotesk.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueLabel,
  tone = 'brand',
}: {
  value: number;
  max?: number;
  label?: string;
  valueLabel?: string;
  tone?: 'brand' | 'accent' | 'ink' | 'success' | 'muted';
}) {
  const fraction = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className={styles.progress}>
      {(label || valueLabel) && (
        <div className={styles.head}>
          {label && <span className={styles.label}>{label}</span>}
          {valueLabel && <span className={styles.value}>{valueLabel}</span>}
        </div>
      )}
      <span className={styles.track} aria-hidden="true">
        <span className={styles[tone]} style={{ transform: `scaleX(${fraction})` }} />
      </span>
    </div>
  );
}
