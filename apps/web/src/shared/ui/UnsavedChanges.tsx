import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useBlocker } from 'react-router';

import { Button } from './Button';
import { Sheet } from './Sheet';
import styles from './UnsavedChanges.module.css';

/**
 * Avisa antes de salir de una pantalla con cambios sin guardar: dentro de la app (volver,
 * la barra de abajo, un enlace) con una hoja, y al cerrar o recargar la pestaña con el aviso
 * del navegador. Cambiar solo los parámetros de la URL (pestañas, filtros) no avisa.
 *
 * Al guardar con éxito, llamar a `release()` antes de navegar: la pantalla todavía cree que
 * tiene cambios (el estado se actualiza después) y el aviso no debe saltar.
 */
export function useUnsavedChanges(dirty: boolean): { prompt: ReactNode; release: () => void } {
  // Se lee al navegar o al cerrar la pestaña, no al dibujar: vive en un ref que se pone al
  // día después de cada cambio (y que `release()` apaga al guardar).
  const guarding = useRef(dirty);
  useLayoutEffect(() => {
    guarding.current = dirty;
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      guarding.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (guarding.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const stay = () => blocker.reset?.();
  const prompt = (
    <Sheet open={blocker.state === 'blocked'} onClose={stay} title="¿Salir sin guardar?">
      <div className={styles.actions}>
        <p>Lo que cambiaste en esta pantalla se pierde.</p>
        <Button onClick={stay}>Seguir aquí</Button>
        <Button variant="danger" onClick={() => blocker.proceed?.()}>
          Salir sin guardar
        </Button>
      </div>
    </Sheet>
  );
  return {
    prompt,
    release: () => {
      guarding.current = false;
    },
  };
}
