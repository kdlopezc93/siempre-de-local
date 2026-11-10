import type { Match } from '@sdl/contracts';

import { Badge } from '../../shared/ui/Badge';
import type { HeaderKid } from '../../shared/ui/TeamHeader';
import { errorMessage } from '../join/use-join';
import { matchTitle, matchWhen } from '../matches/match-view';
import styles from './Family.module.css';
import { ReplyButtons } from './ReplyButtons';
import { useReplyForChild } from './use-family';

/** "¿Sofía va al entreno?" o "¿Sofía va contra Real Bosa?" */
const question = (name: string, match: Match) =>
  match.kind === 'training' ? `¿${name} va al entreno?` : `¿${name} va contra ${match.opponent}?`;

/**
 * Una convocatoria del niño con Va / No va. `lead`: el bloque cobalto del inicio; si no, una
 * tarjeta de la lista de partidos.
 */
export function CallCard({
  seat,
  match,
  lead = false,
  focused = false,
}: {
  seat: HeaderKid;
  match: Match;
  lead?: boolean;
  /** El partido del aviso que abrió la pantalla. */
  focused?: boolean;
}) {
  const reply = useReplyForChild(seat.id, seat.teamId);
  const Title = lead ? 'h2' : 'h3';
  return (
    <article
      className={lead ? styles.lead : styles.call}
      data-focused={focused || undefined}
      aria-labelledby={`call-${match.id}`}
    >
      <div className={styles.callHead}>
        <span className={styles.overline}>{lead ? 'Lo que toca' : matchTitle(match)}</span>
        {!lead && !match.myReply && <Badge tone="warning">Responder</Badge>}
      </div>
      <Title id={`call-${match.id}`} className={styles.callTitle}>
        {question(seat.name, match)}
      </Title>
      <p className={styles.callWhen}>
        {matchWhen(match.startsAt)}, {match.place}
      </p>
      <ReplyButtons
        name={seat.name}
        value={match.myReply}
        busy={reply.isPending}
        onBrand={lead}
        onReply={(r) => reply.mutate({ matchId: match.id, reply: r })}
      />
      {reply.isError && (
        <p role="alert" className={styles.callError}>
          {errorMessage(reply.error)}
        </p>
      )}
    </article>
  );
}
