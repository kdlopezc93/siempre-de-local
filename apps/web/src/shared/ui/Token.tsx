import { LINE_OF, type PositionCode } from '@sdl/domain';

import styles from './Token.module.css';

export type TokenLine = 'portero' | 'defensa' | 'medio' | 'ataque';

/** La línea de una posición, para el aro de la ficha (el portero tiene la suya). */
export const lineOfPosition = (position: PositionCode): TokenLine =>
  position === 'POR' ? 'portero' : LINE_OF[position];

/**
 * La ficha magnética de la pizarra: el dorsal (o unas iniciales) en un disco con el aro del
 * color de su línea. Decorativa por defecto: quien la usa pone el nombre al lado; si va sola,
 * pasa `label` para lectores de pantalla.
 */
export function Token({
  text,
  line = null,
  size = 'md',
  tone = 'board',
  injured = false,
  label,
}: {
  text: string;
  line?: TokenLine | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `brand`: el equipo o lo elegido, rellena de cobalto. */
  tone?: 'board' | 'brand';
  /** Lesionado: una crucecita de botiquín en la esquina (quien la usa también lo dice en texto). */
  injured?: boolean;
  label?: string;
}) {
  return (
    <span
      className={[styles.token, styles[size], styles[tone]].join(' ')}
      data-line={line ?? undefined}
      data-injured={injured || undefined}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {text}
    </span>
  );
}
