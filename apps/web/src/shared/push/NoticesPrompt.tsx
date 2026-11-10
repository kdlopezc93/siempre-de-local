import { Bell } from '@phosphor-icons/react/dist/csr/Bell';

import { Button } from '../ui/Button';
import styles from './NoticesPrompt.module.css';
import { usePush } from './use-push';

/**
 * "Activa los avisos" (2026-11-10, para todos): sin ellos no te enteras de la convocatoria hasta
 * abrir la app. Solo si este celular puede tenerlos y están apagados; en iPhone sin la app en el
 * inicio, dice cómo. Activados o imposibles, no sale. `child`: en la app del acudiente, habla del
 * niño.
 */
export function NoticesPrompt({ child }: { child?: string }) {
  const { state, toggle } = usePush();
  if (state !== 'off' && state !== 'ios-install') return null;
  return (
    <section className={styles.notices} aria-labelledby="avisos-titulo">
      <span className={styles.noticesIcon} aria-hidden="true">
        <Bell size={22} />
      </span>
      <div className={styles.noticesText}>
        <h2 id="avisos-titulo" className={styles.noticesTitle}>
          Activa los avisos
        </h2>
        <p className={styles.muted}>
          {state === 'off'
            ? child
              ? `Para enterarte en este celular cuando convoquen a ${child} y responder desde el aviso.`
              : 'Para enterarte en este celular cuando te convoquen, salga la alineación o haya un cobro, y responder desde el aviso.'
            : 'En iPhone, primero agrega la app al inicio (Compartir → Agregar a inicio) y ábrela desde ahí.'}
        </p>
        {state === 'off' && (
          <Button variant="secondary" busy={toggle.isPending} onClick={() => toggle.mutate(true)}>
            {toggle.isPending ? 'Activando…' : 'Activar avisos'}
          </Button>
        )}
        {toggle.isError && (
          <p role="alert" className={styles.error}>
            No pudimos activar los avisos. Revisa que el celular los permita e intenta de nuevo.
          </p>
        )}
      </div>
    </section>
  );
}
