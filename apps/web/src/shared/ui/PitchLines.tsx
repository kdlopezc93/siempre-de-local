import styles from './Pitch.module.css';

/** Franjas de corte del pasto, cada 15 unidades (como una cancha recién podada). */
const STRIPES = Array.from({ length: 5 }, (_, i) => i * 30);

/**
 * La cancha (viewBox 100×150): pasto con franjas y líneas blancas, como SportField del sistema
 * de diseño. La comparten la pizarra del examen, el planificador y la alineación publicada.
 */
export function PitchLines() {
  return (
    <>
      <rect x="0" y="0" width="100" height="150" rx="4" className={styles.turf} />
      {STRIPES.map((y) => (
        <rect key={y} x="0" y={y} width="100" height="15" className={styles.stripe} />
      ))}
      <g className={styles.lines}>
        <rect x="3" y="3" width="94" height="144" />
        <line x1="3" y1="75" x2="97" y2="75" />
        <circle cx="50" cy="75" r="11" />
        <rect x="26" y="126" width="48" height="21" />
        <rect x="38" y="140" width="24" height="7" />
        <rect x="26" y="3" width="48" height="21" />
        <rect x="38" y="3" width="24" height="7" />
      </g>
      <circle cx="50" cy="75" r="1.2" className={styles.spot} />
    </>
  );
}
