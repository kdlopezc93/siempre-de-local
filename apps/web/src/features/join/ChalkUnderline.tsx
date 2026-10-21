import styles from './ChalkUnderline.module.css';

/** Subrayado a mano en tiza ámbar, como cuando el técnico marca un nombre en la pizarra. */
export function ChalkUnderline() {
  // Se anima el contenedor, no el <svg>: así el navegador lo compone en la GPU.
  return (
    <span className={styles.wrapper} aria-hidden="true">
      <svg
        className={styles.line}
        viewBox="0 0 240 14"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path d="M3 9 C 40 4, 78 11, 118 7 S 196 3, 237 8" />
        <path d="M22 12 C 70 9, 140 12, 214 9" className={styles.second} />
      </svg>
    </span>
  );
}
