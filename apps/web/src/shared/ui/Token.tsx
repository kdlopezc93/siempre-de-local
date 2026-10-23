import { LINE_OF, type PositionCode } from '@sdl/domain';
import { useState } from 'react';

import { photoSrc } from '../api/photos';

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
  label,
  photo,
}: {
  text: string;
  line?: TokenLine | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `amber`: el equipo o lo elegido, rellena de ámbar. */
  tone?: 'board' | 'amber';
  label?: string;
  /** Ruta de su foto (del API): reemplaza al texto dentro del disco; el aro se queda. */
  photo?: string | null | undefined;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const src = photoSrc(photo);
  const showPhoto = src !== undefined && broken !== src;
  return (
    <span
      className={[styles.token, styles[size], styles[tone]].join(' ')}
      data-line={line ?? undefined}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          className={styles.photo}
          decoding="async"
          loading="lazy"
          onError={() => setBroken(src)}
        />
      ) : (
        text
      )}
    </span>
  );
}
