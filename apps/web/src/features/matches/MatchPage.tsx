import type { Match, MatchRoster } from '@sdl/contracts';
import { findFormation } from '@sdl/domain';
import { useState } from 'react';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { Token } from '../../shared/ui/Token';
import { FORMAT_LABEL } from '../shell/shell-nav';
import { usePublishLineup, useLineups } from '../lineup/use-lineups';
import { AfterMatch, MatchResultView } from './AfterMatch';
import { matchWhen, slotName } from './match-view';
import { PublishedBoard } from './PublishedBoard';
import styles from './Matches.module.css';
import { useMatch, usePublishedLineup, useReplyMatch, useUpdateMatch } from './use-matches';

/**
 * /equipos/:teamId/partidos/:matchId — el partido: responder, y para el cuerpo técnico, quién va
 * y, ya jugado, el resultado y cómo jugó cada uno.
 */
export function MatchPage({ me, teamId, matchId }: { me: Me; teamId: string; matchId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId);
  const roles = membership?.roles ?? [];
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
  // Ya jugado (D18): el cuerpo técnico carga el resultado y evalúa; el resto lo ve. Las
  // respuestas (voy / no voy) ya no hacen falta.
  const played = match.status === 'scheduled' && !match.open;
  const teamName = membership?.team.name ?? 'Nosotros';

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

      {played &&
        (staff && roster ? (
          <AfterMatch teamId={teamId} teamName={teamName} match={match} roster={roster} />
        ) : (
          <MatchResultView teamName={teamName} match={match} meId={me.user.id} />
        ))}

      {match.published && (
        <PublishedSection teamId={teamId} match={match} meId={me.user.id} player={player} />
      )}

      {!played && player && <ReplyButtons teamId={teamId} match={match} />}

      {!played && (
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
          {match.replies.injured > 0 && (
            <div>
              <dt>Lesionados</dt>
              <dd>{match.replies.injured}</dd>
            </div>
          )}
        </dl>
      )}

      {staff && <MatchLineups teamId={teamId} match={match} />}
      {roster && !played && <Roster roster={roster} />}
      {/* Hasta cargar el resultado, aunque ya pasó la hora: corregir la hora o cancelarlo. */}
      {staff && match.editable && <StaffActions teamId={teamId} match={match} />}
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

/** Quién va, quién no, quién falta y los lesionados que no respondieron (no "faltan"). */
const GROUPS: { title: string; has: (p: MatchRoster[number]) => boolean }[] = [
  { title: 'Van', has: (p) => p.reply === 'yes' },
  { title: 'No van', has: (p) => p.reply === 'no' },
  { title: 'Faltan', has: (p) => p.reply === null && !p.injured },
  { title: 'Lesionados', has: (p) => p.reply === null && p.injured },
];

function Roster({ roster }: { roster: MatchRoster }) {
  return (
    <>
      {GROUPS.map(({ title, has }) => {
        const people = roster.filter(has);
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
                    injured={p.injured}
                  />
                  <span>
                    {p.displayName}
                    {p.injured && <span className="sr-only">, lesionado</span>}
                  </span>
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
          <p>
            El equipo lo verá cancelado y ya no se podrá responder ni editar. Queda en la cuenta de
            partidos cancelados.
          </p>
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

/**
 * La alineación del partido (Fase 7): armarla con los que van, sus guardadas y publicar una
 * para el equipo (D17: se republica hasta la hora del partido).
 */
function MatchLineups({ teamId, match }: { teamId: string; match: Match }) {
  const lineups = useLineups(teamId);
  const publish = usePublishLineup(teamId);
  const mine = (lineups.data?.items ?? []).filter((l) => l.matchId === match.id);
  const publishedId = match.published?.lineupId ?? null;
  return (
    <section aria-labelledby="alineacion" className={styles.section}>
      <h2 id="alineacion" className={styles.sectionTitle}>
        Alineación
      </h2>
      {publishedId && match.published && (
        <p className={styles.published}>
          Publicada el {matchWhen(match.published.at)}: el equipo ya la ve.
        </p>
      )}
      {match.open && (
        <ButtonLink to={`/equipos/${teamId}/planificador?partido=${match.id}`}>
          {mine.length ? 'Armar otra' : 'Armar la alineación'}
        </ButtonLink>
      )}
      {mine.length > 0 && (
        <ul className={styles.lineups}>
          {mine.map((l) => (
            <li key={l.id}>
              <Link to={`/equipos/${teamId}/alineaciones/${l.id}`} className={styles.lineupName}>
                {l.name}
              </Link>
              {l.id === publishedId ? (
                <span className={styles.publishedTag}>Publicada</span>
              ) : (
                match.open && (
                  <button
                    type="button"
                    className={styles.publishButton}
                    disabled={publish.isPending}
                    onClick={() => publish.mutate(l.id)}
                  >
                    {publishedId ? 'Publicar esta' : 'Publicar'}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {publish.isError && (
        <p role="alert" className={styles.error}>
          No pudimos publicarla. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </section>
  );
}

/** La alineación publicada, para todo el equipo (D17): dónde estás tú, la cancha y el banco. */
function PublishedSection({
  teamId,
  match,
  meId,
  player,
}: {
  teamId: string;
  match: Match;
  meId: string;
  player: boolean;
}) {
  const lineup = usePublishedLineup(teamId, match.id, match.published?.at ?? null);
  if (!lineup.data) {
    return lineup.isError ? (
      <p role="alert" className={styles.muted}>
        No pudimos cargar la alineación. Revisa tu conexión.
      </p>
    ) : null;
  }
  const data = lineup.data;
  const formation = findFormation(data.formation);
  const mySlot = data.starters.find((s) => s.player?.id === meId);
  const slot = mySlot && formation?.slots.find((s) => s.id === mySlot.slotId);
  const onBench = data.bench.some((p) => p.id === meId);
  return (
    <section aria-labelledby="la-alineacion" className={styles.section}>
      <h2 id="la-alineacion" className={styles.sectionTitle}>
        La alineación
      </h2>
      {player && (
        <p className={styles.myPlace}>
          {slot
            ? `Eres titular: ${slotName(slot)}.`
            : onBench
              ? 'Vas al banco.'
              : 'Esta vez no estás en la lista.'}
        </p>
      )}
      <PublishedBoard lineup={data} meId={meId} />
      <h3 className={styles.sectionTitle}>Suplentes ({data.bench.length})</h3>
      <p className={styles.muted}>
        {data.bench.length
          ? data.bench
              .map((p) =>
                p.jerseyNumber !== null ? `${p.jerseyNumber} ${p.displayName}` : p.displayName,
              )
              .join(', ')
          : 'Ninguno.'}
      </p>
      <p className={styles.muted}>Publicada el {matchWhen(data.publishedAt)}.</p>
    </section>
  );
}
