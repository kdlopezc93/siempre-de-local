import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet';

import type { Me } from '../../shared/api/auth';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import type { HeaderKid } from '../../shared/ui/TeamHeader';
import { TaskRow } from '../../shared/ui/TaskCard';
import { pesos } from '../charges/charge-view';
import { useMyCharges } from '../charges/use-charges';
import { CallCard } from './CallCard';
import { NoticesPrompt } from './NoticesPrompt';
import styles from './Family.module.css';
import { firstName, kidPath, nextCall } from './family-nav';
import { useChildMatches } from './use-family';

const TODAY = new Intl.DateTimeFormat('es-419', { weekday: 'long', day: 'numeric', month: 'long' });
const today = () => {
  const text = TODAY.format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * /deportistas/:minorId/equipos/:teamId — lo que toca por el niño (registro familia): la próxima
 * convocatoria se responde ahí mismo, y abajo lo que falta pagar y las demás por responder.
 */
export function ChildHomePage({ me, seat }: { me: Me; seat: HeaderKid }) {
  const matches = useChildMatches(seat.id, seat.teamId);
  const charges = useMyCharges(seat.teamId, true, seat.id);
  const { lead, unanswered } = nextCall(matches.data?.items ?? []);
  const rest = lead && !lead.myReply ? unanswered - 1 : unanswered;
  const owed = charges.data?.owed ?? 0;

  return (
    <Screen className={styles.screen}>
      <PageTitle
        eyebrow={`Hola, ${firstName(me.profile.displayName)}`}
        title={`Lo de ${seat.name}`}
        subtitle={today()}
      />
      {matches.isPending ? (
        <p className="sr-only" role="status">
          Cargando lo de {seat.name}…
        </p>
      ) : matches.isError ? (
        <p role="alert" className={styles.muted}>
          No pudimos cargar los partidos de {seat.name}. Revisa tu conexión.
        </p>
      ) : lead ? (
        <CallCard seat={seat} match={lead} lead />
      ) : (
        <p className={styles.done}>
          <CheckCircle size={24} weight="fill" aria-hidden="true" />
          No hay convocatorias por ahora.
        </p>
      )}
      <NoticesPrompt name={seat.name} />
      <div className={styles.group}>
        {owed > 0 && (
          <TaskRow
            to={kidPath(seat, 'cuentas')}
            icon={Wallet}
            tint={2}
            title={`Por pagar: ${pesos(owed)}`}
          />
        )}
        {rest > 0 && (
          <TaskRow
            to={kidPath(seat, 'partidos')}
            icon={CalendarCheck}
            tint={1}
            title={rest === 1 ? 'Otra convocatoria por responder' : 'Convocatorias por responder'}
            count={rest}
          />
        )}
      </div>
    </Screen>
  );
}
