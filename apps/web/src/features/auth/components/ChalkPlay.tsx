import { useId } from 'react';

import styles from './ChalkPlay.module.css';

/**
 * Nuestra mitad de cancha dibujada en la pizarra, con una jugada: un pase del central
 * y la subida del lateral (en ámbar). El arco propio queda abajo, como en la pizarra
 * del prototipo. Es decorativa: el texto de la pantalla dice lo importante.
 */
export function ChalkPlay({ className }: { className?: string }) {
  const id = useId();
  const chalk = `${id}-chalk`;
  const runHead = `${id}-run`;
  const passHead = `${id}-pass`;

  return (
    <svg
      viewBox="0 0 320 250"
      className={[styles.board, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Textura de tiza: el trazo tiembla un poco, como hecho a mano. */}
        <filter id={chalk} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="1.8" />
        </filter>
        <marker
          id={runHead}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" className={styles.arrowhead} />
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
          <path d="M0 0 10 5 0 10z" className={styles.passhead} />
        </marker>
      </defs>

      <g filter={`url(#${chalk})`}>
        {/* Media cancha propia: medio campo arriba, nuestro arco abajo. */}
        <g className={styles.pitch}>
          <path d="M14 18H306V244H14Z" />
          <path d="M120 18a40 40 0 0 0 80 0" />
          <path d="M86 244V178H234V244" />
          <path d="M126 244V218H194V244" />
          <path d="M134 178a30 30 0 0 1 52 0" />
          <path d="M146 244v4h28v-4" />
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
        {/* Subida del lateral, en ámbar: la jugada que se marca en la pizarra */}
        <path
          className={styles.run}
          d="M70 128C84 92 102 70 132 44"
          markerEnd={`url(#${runHead})`}
        />
      </g>
    </svg>
  );
}
