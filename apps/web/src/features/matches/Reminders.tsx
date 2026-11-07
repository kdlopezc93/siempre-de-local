import type { Match } from '@sdl/contracts';
import { BellRinging } from '@phosphor-icons/react/dist/csr/BellRinging';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { reminderLine, sinceLabel, timeLabel } from './match-view';
import styles from './Matches.module.css';
import { useRemindMatch } from './use-matches';

/**
 * El recordatorio de la convocatoria (2026-11-06, Kevin aprobó la maqueta), debajo de los que
 * faltan por responder: "Recordarles ahora" (una vez cada 2 horas) y cuándo les recuerda la app
 * sola. Solo el cuerpo técnico, mientras se puede responder.
 */
export function Reminders({
  teamId,
  match,
  pending,
  now = new Date(),
}: {
  teamId: string;
  match: Match;
  pending: number;
  now?: Date;
}) {
  const remind = useRemindMatch(teamId, match.id);
  const reminders = match.reminders;
  if (!reminders) return null;
  const blocked = reminders.blockedUntil !== null && new Date(reminders.blockedUntil) > now;
  const auto = reminders.enabled
    ? reminderLine(reminders.upcoming)
    : 'El recordatorio automático está apagado en Datos y ajustes.';
  const error =
    remind.error instanceof ApiError && remind.error.status < 500
      ? remind.error.message
      : remind.isError
        ? 'No pudimos mandar el recordatorio. Revisa tu conexión e intenta de nuevo.'
        : null;
  return (
    <div className={styles.reminders}>
      {pending > 0 &&
        (blocked && reminders.lastManualAt ? (
          <>
            <Button variant="secondary" disabled>
              Les recordaste {sinceLabel(reminders.lastManualAt, now)}
            </Button>
            <p className={styles.reminderNote}>
              <Clock size={16} aria-hidden="true" />
              Puedes volver a recordarles desde las {timeLabel(reminders.blockedUntil!)}, para no
              llenarles el celular.
            </p>
          </>
        ) : (
          <Button variant="secondary" busy={remind.isPending} onClick={() => remind.mutate()}>
            <BellRinging size={20} weight="bold" aria-hidden="true" />
            Recordarles ahora
          </Button>
        ))}
      {remind.isSuccess && (
        <p className="sr-only" role="status">
          Listo, les recordamos a {remind.data.reminded}.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.reminderError}>
          {error}
        </p>
      )}
      {auto && (
        <p className={styles.reminderNote}>
          <Clock size={16} aria-hidden="true" />
          {auto}
        </p>
      )}
    </div>
  );
}
