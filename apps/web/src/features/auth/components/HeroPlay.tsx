import { useId } from 'react';

import styles from './HeroPlay.module.css';

/**
 * Nuestra mitad de cancha dentro del bloque cobalto de la entrada, con una jugada: un pase
 * del central y la subida del lateral (en volt). El arco propio queda abajo. Es decorativa:
 * el texto de la pantalla dice lo importante.
 */
export function HeroPlay({ className }: { className?: string | undefined }) {
  const id = useId();
  const runHead = `${id}-run`;
  const passHead = `${id}-pass`;

  return (
    <svg
      viewBox="0 0 320 250"
      className={[styles.play, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id={runHead}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" className={styles.runHead} />
        </marker>
        <marker
          id={passHead}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="4.5"
          markerHeight="4.5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" className={styles.passHead} />
        </marker>
      </defs>

      {/* Media cancha propia: medio campo arriba, nuestro arco abajo. */}
      <g className={styles.pitch}>
        <rect x="14" y="18" width="292" height="226" rx="6" />
        <path d="M120 18a40 40 0 0 0 80 0" />
        <path d="M86 244V178H234V244" />
        <path d="M126 244V218H194V244" />
        <path d="M134 178a30 30 0 0 1 52 0" />
      </g>
      <circle cx="160" cy="18" r="2.4" className={styles.spot} />
      <circle cx="160" cy="200" r="2" className={styles.spot} />

      {/* Rivales (X) */}
      <g className={styles.rival}>
        <path d="M193 70l12 12M205 70l-12 12" />
        <path d="M112 90l12 12M124 90l-12 12" />
        <path d="M244 132l12 12M256 132l-12 12" />
      </g>

      {/* Los nuestros (O) */}
      <g className={styles.ours}>
        <circle cx="160" cy="160" r="8" />
        <circle cx="64" cy="138" r="8" />
        <circle cx="250" cy="98" r="8" />
        <circle cx="160" cy="104" r="8" />
      </g>

      {/* Pase del central al volante */}
      <path className={styles.pass} d="M160 150V118" markerEnd={`url(#${passHead})`} />
      {/* Subida del lateral, en volt: la jugada que se marca */}
      <path className={styles.run} d="M70 128C84 92 102 70 132 44" markerEnd={`url(#${runHead})`} />
    </svg>
  );
}
