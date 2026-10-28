import styles from './Avatar.module.css';
import { initialsOf } from './TeamHeader';
import type { TokenLine } from './Token';

/** El tinte sale del nombre: la misma persona tiene siempre el mismo color. */
const tintOf = (name: string) => ((name.codePointAt(0) ?? 0) % 6) + 1;

/**
 * La cara de una persona en listas y encabezados: sus iniciales sobre un tinte de color, en un
 * cuadrado muy redondeado (squircle). `circle` para el cuerpo técnico. Con `line`, un aro del
 * color de su línea (como las fichas de la cancha); con `injured`, la crucecita de botiquín.
 * Decorativo: quien lo usa pone el nombre al lado (y dice en texto si está lesionado).
 */
export function Avatar({
  name,
  size = 44,
  shape = 'squircle',
  line = null,
  ring,
  injured = false,
  label,
}: {
  name: string;
  size?: 32 | 40 | 44 | 48 | 56 | 64 | 72;
  shape?: 'squircle' | 'circle';
  /** La línea de su posición: el aro toma su color. */
  line?: TokenLine | null;
  /** Un aro de otro color (el del podio). Gana sobre `line`. */
  ring?: string;
  injured?: boolean;
  /** Lo que va adentro en vez de las iniciales: el dorsal ("7") o una posición ("DFC"). */
  label?: string | null;
}) {
  const text = label ?? initialsOf(name);
  const numeric = /^\d+$/.test(text);
  const ringColor = ring ?? (line ? `var(--sdl-line-${line})` : undefined);
  return (
    <span
      className={[styles.avatar, styles[shape]].join(' ')}
      data-tint={tintOf(name)}
      data-injured={injured || undefined}
      data-numeric={numeric || undefined}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * (text.length > 2 ? 0.3 : numeric ? 0.42 : 0.36)),
        ...(ringColor
          ? { boxShadow: `0 0 0 2.5px var(--sdl-surface), 0 0 0 5px ${ringColor}` }
          : {}),
      }}
      aria-hidden="true"
    >
      {text}
    </span>
  );
}
