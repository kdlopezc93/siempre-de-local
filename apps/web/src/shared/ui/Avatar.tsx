import styles from './Avatar.module.css';
import { initialsOf } from './TeamHeader';

/** El tinte sale del nombre: la misma persona tiene siempre el mismo color. */
const tintOf = (name: string) => ((name.codePointAt(0) ?? 0) % 6) + 1;

/**
 * La cara de una persona en listas y encabezados: sus iniciales sobre un tinte de color, en un
 * cuadrado muy redondeado (squircle). `circle` para el cuerpo técnico. Decorativo: quien lo usa
 * pone el nombre al lado.
 */
export function Avatar({
  name,
  size = 44,
  shape = 'squircle',
  ring,
}: {
  name: string;
  size?: 32 | 40 | 44 | 48 | 64;
  shape?: 'squircle' | 'circle';
  /** Un aro de color (el de su línea, o el del podio). */
  ring?: string;
}) {
  return (
    <span
      className={[styles.avatar, styles[shape]].join(' ')}
      data-tint={tintOf(name)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        ...(ring ? { boxShadow: `0 0 0 2.5px var(--sdl-surface), 0 0 0 5px ${ring}` } : {}),
      }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
