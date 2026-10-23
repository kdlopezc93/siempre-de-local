import { X } from '@phosphor-icons/react/dist/csr/X';
import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react';

import styles from './Sheet.module.css';

/** Cuánto hay que arrastrar hacia abajo para cerrarla. */
const DISMISS_PX = 80;

/**
 * Hoja inferior: sube desde abajo sobre un velo. Se cierra con la X, tocando el velo, con
 * Escape o arrastrándola hacia abajo desde la manija. Es un `<dialog>` modal: atrapa el foco
 * y lo devuelve al cerrar.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.style.removeProperty('--drag');
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.dataset['closing'] = '';
      const ms = parseFloat(getComputedStyle(dialog).getPropertyValue('--sdl-duration-exit')) || 0;
      const timer = setTimeout(() => {
        delete dialog.dataset['closing'];
        dialog.close();
      }, ms);
      return () => clearTimeout(timer);
    }
  }, [open]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    drag.current = { y: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, event.clientY - drag.current.y);
    // Mientras se arrastra, la hoja sigue al dedo sin transición.
    ref.current.dataset['dragging'] = '';
    ref.current.style.setProperty('--drag', `${drag.current.dy}px`);
  }
  function onPointerUp() {
    const dy = drag.current?.dy ?? 0;
    drag.current = null;
    if (ref.current) delete ref.current.dataset['dragging'];
    if (dy > DISMISS_PX) onClose();
    else ref.current?.style.removeProperty('--drag');
  }

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // El velo es el propio <dialog>: un toque fuera del panel lo cierra.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div
          className={styles.handle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden="true"
        >
          <span />
        </div>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
