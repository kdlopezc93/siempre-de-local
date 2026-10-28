import type { ComponentProps } from 'react';
import { Link } from 'react-router';

import styles from './Button.module.css';

type ButtonLinkVariant = 'primary' | 'secondary' | 'accent';

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonLinkVariant;
}

/** Un enlace con forma de botón: lleva a otra pantalla, así que es <a>, no <button>. */
export function ButtonLink({ variant = 'primary', className, ...props }: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={[styles.button, styles.link, styles[variant], className].filter(Boolean).join(' ')}
    />
  );
}
