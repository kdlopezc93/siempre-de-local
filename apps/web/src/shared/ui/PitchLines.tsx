import styles from './Pitch.module.css';

/** Las líneas de la cancha (viewBox 100×150): las comparten la pizarra y el planificador. */
export function PitchLines() {
  return (
    <>
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
