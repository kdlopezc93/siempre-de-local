import type { ComponentProps } from 'react';

import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';

/** ComponentProps incluye `ref` (React 19 lo pasa como prop): permite mover el foco. */
interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  /** Mientras es true el botón se deshabilita y se anuncia como ocupado. */
  busy?: boolean;
}

export function Button({
  variant = 'primary',
  busy = false,
  disabled,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
    />
  );
}
