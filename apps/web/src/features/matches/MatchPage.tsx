import type { Match, MatchRoster } from '@sdl/contracts';
import { useState } from 'react';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { Token } from '../../shared/ui/Token';
import { FORMAT_LABEL } from '../shell/shell-nav';
import { matchWhen } from './match-view';
import styles from './Matches.module.css';
import { useMatch, useReplyMatch, useUpdateMatch } from './use-matches';

/** /equipos/:teamId/partidos/:matchId — el partido: responder, y para el cuerpo técnico, quién va. */
export function MatchPage({ me, teamId, matchId }: { me: Me; teamId: string; matchId: string }) {
  const roles = me.teams.find((t) => t.team.id === teamId)?.roles ?? [];
  const staff = roles.includes('coach') || roles.includes('assistant');
  const player = roles.includes('player');
  const data = useMatch(teamId, matchId);
  const back = (
    <Link to={`/equipos/${teamId}/partidos`} className={styles.back}>
      Partidos
    </Link>
  );

  if (data.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando el partido…
        </p>
      </Screen>
    );
  }
  if (data.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert">
          {data.error instanceof ApiError && data.error.status === 404
            ? 'No encontramos ese partido.'
            : 'No pudimos cargar el partido. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }
  const { match, roster } = data.data;

  return (
    <Screen className={styles.screen}>
      {back}
      <header>
        <h1 className={styles.title}>{match.opponent}</h1>
        <p className={styles.when}>{matchWhen(match.startsAt)}</p>
        <p className={styles.muted}>
          {match.place}, {FORMAT_LABEL[match.format]}
        </p>
        {!match.open && (
          <p className={styles.closed}>
            {match.status === 'cancelled' ? 'Partido cancelado.' : 'El partido ya empezó.'}
          </p>
        )}
      </header>

      {player && <ReplyButtons teamId={teamId} match={match} />}

      <dl className={styles.counts}>
        <div>
          <dt>Van</dt>
          <dd>{match.replies.yes}</dd>
        </div>
        <div>
          <dt>No van</dt>
          <dd>{match.replies.no}</dd>
        </div>
        <div>
          <dt>Faltan</dt>
          <dd>{match.replies.pending}</dd>
        </div>
      </dl>

      {roster && <Roster roster={roster} />}
      {staff && match.open && <StaffActions teamId={teamId} match={match} />}
    </Screen>
  );
}

function ReplyButtons({ teamId, match }: { teamId: string; match: Match }) {
  const reply = useReplyMatch(teamId, match.id);
  return (
    <section aria-labelledby="tu-respuesta" className={styles.section}>
      <h2 id="tu-respuesta" className={styles.sectionTitle}>
        {match.myReply ? 'Tu respuesta' : '¿Vas?'}
      </h2>
      <div className={styles.replies}>
        {(['yes', 'no'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={styles.replyButton}
            aria-pressed={match.myReply === value}
            disabled={!match.open || reply.isPending}
            onClick={() => reply.mutate(value)}
          >
            {value === 'yes' ? 'Voy' : 'No voy'}
          </button>
        ))}
      </div>
      {match.open && match.myReply && (
        <p className={styles.muted}>Puedes cambiarla hasta la hora del partido.</p>
      )}
      {reply.isError && (
        <p role="alert" className={styles.error}>
          {reply.error instanceof ApiError && reply.error.status < 500
            ? reply.error.message
            : 'No pudimos guardar tu respuesta. Revisa tu conexión e intenta de nuevo.'}
        </p>
      )}
    </section>
  );
}

const GROUPS = [
  { reply: 'yes', title: 'Van' },
  { reply: 'no', title: 'No van' },
  { reply: null, title: 'Faltan' },
] as const;

function Roster({ roster }: { roster: MatchRoster }) {
  return (
    <>
      {GROUPS.map(({ reply, title }) => {
        const people = roster.filter((p) => p.reply === reply);
        if (people.length === 0) return null;
        return (
          <section key={title} aria-label={title} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {title} ({people.length})
            </h2>
            <ul className={styles.people}>
              {people.map((p) => (
                <li key={p.playerId}>
                  <Token
                    text={
                      p.jerseyNumber !== null ? String(p.jerseyNumber) : initialsOf(p.displayName)
                    }
                    size="sm"
                  />
                  <span>{p.displayName}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function StaffActions({ teamId, match }: { teamId: string; match: Match }) {
  const update = useUpdateMatch(teamId, match.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={styles.actions}>
      <Link to={`/equipos/${teamId}/partidos/${match.id}/editar`} className={styles.secondaryLink}>
        Editar el partido
      </Link>
      <button type="button" className={styles.dangerLink} onClick={() => setConfirm(true)}>
        Cancelar el partido
      </button>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Cancelar el partido?">
        <div className={styles.sheetActions}>
          <p>El equipo lo verá cancelado y ya no se podrá responder ni editar.</p>
          {update.isError && (
            <p role="alert" className={styles.error}>
              No pudimos cancelarlo. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
          <Button
            variant="danger"
            busy={update.isPending}
            onClick={() =>
              update.mutate({ status: 'cancelled' }, { onSuccess: () => setConfirm(false) })
            }
          >
            Sí, cancelarlo
          </Button>
          <Button variant="ghost" disabled={update.isPending} onClick={() => setConfirm(false)}>
            No
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
