import type { Match, MatchRatingValue, MatchRoster } from '@sdl/contracts';
import { Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { useCallback, useEffect, useId, useState } from 'react';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { whyCannotRate } from '../squad/who-rates';
import { useSession } from '../auth/use-session';
import { RATING_OPTIONS, ratingLabel, type RatablePlayer, whoPlayed } from './after-match';
import styles from './AfterMatch.module.css';
import {
  useMatchRatings,
  usePublishedLineup,
  useRateMatchPlayer,
  useRecordMatchResult,
} from './use-matches';
import { Avatar } from '../../shared/ui/Avatar';

const tokenText = (p: { jerseyNumber: number | null; displayName: string }) =>
  p.jerseyNumber !== null ? String(p.jerseyNumber) : initialsOf(p.displayName);

const failure = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status < 500 ? error.message : fallback;

/**
 * Después del partido (D18), para el cuerpo técnico: el marcador con la figura y cómo jugó
 * cada uno. Cada evaluación se guarda al tocarla.
 */
export function AfterMatch({
  teamId,
  teamName,
  match,
  roster,
}: {
  teamId: string;
  teamName: string;
  match: Match;
  roster: MatchRoster;
}) {
  const ratings = useMatchRatings(teamId, match.id);
  const lineup = usePublishedLineup(teamId, match.id, match.published?.at ?? null);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);
  // Un solo aviso de cambios sin guardar para toda la pantalla (React Router admite un bloqueo
  // a la vez): el marcador y cada nota avisan si tienen algo pendiente.
  const [unsaved, setUnsaved] = useState<ReadonlySet<string>>(new Set());
  const report = useCallback<ReportUnsaved>((key, dirty) => {
    setUnsaved((prev) => {
      if (prev.has(key) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const guard = useUnsavedChanges(unsaved.size > 0);
  const myUserId = useSession().data?.user.id;
  const { played, others } = whoPlayed({
    roster,
    lineup: lineup.data ?? null,
    ratings: ratings.data?.items ?? [],
    added,
  });
  const byPlayer = new Map((ratings.data?.items ?? []).map((r) => [r.playerId, r]));
  const rated = played.filter((p) => byPlayer.has(p.playerId)).length;

  return (
    <>
      {guard.prompt}
      <ResultBoard
        report={report}
        teamId={teamId}
        teamName={teamName}
        match={match}
        candidates={played.length ? played : others}
      />

      <section aria-labelledby="como-jugo" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="como-jugo" className={styles.sectionTitle}>
            Cómo jugó cada uno
          </h2>
          {played.length > 0 && (
            <p className={styles.progress}>
              {rated} de {played.length}
            </p>
          )}
        </div>
        {ratings.isError && (
          <p role="alert" className={styles.error}>
            No pudimos cargar las evaluaciones. Revisa tu conexión.
          </p>
        )}
        {played.length === 0 && (
          <p className={styles.muted}>
            Nadie quedó en la alineación ni dijo “voy”. Agrega a los que jugaron.
          </p>
        )}
        <ul className={styles.players}>
          {played.map((p) => {
            const current = byPlayer.get(p.playerId);
            if (!p.canRate) {
              return (
                <FixedRow
                  key={p.playerId}
                  player={p}
                  rating={(current?.rating as MatchRatingValue | undefined) ?? null}
                  why={whyCannotRate(p.playerId, myUserId)}
                />
              );
            }
            return (
              <RatingRow
                report={report}
                key={p.playerId}
                teamId={teamId}
                matchId={match.id}
                player={p}
                rating={(current?.rating as MatchRatingValue | undefined) ?? null}
                note={current?.note ?? null}
              />
            );
          })}
        </ul>
        {others.length > 0 && (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            Agregar a otro que jugó
          </Button>
        )}
        <Sheet open={adding} onClose={() => setAdding(false)} title="¿Quién más jugó?">
          <ul className={styles.pickList}>
            {others.map((p) => (
              <li key={p.playerId}>
                <button
                  type="button"
                  className={styles.pick}
                  onClick={() => {
                    setAdded(new Set([...added, p.playerId]));
                    setAdding(false);
                  }}
                >
                  <Avatar name={p.displayName} label={tokenText(p)} size={32} />
                  <span>{p.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      </section>
    </>
  );
}

/** El marcador de pizarra: goles de cada lado con − y +, y la figura del partido. */
type ReportUnsaved = (key: string, dirty: boolean) => void;

/** Avisa a la pantalla si esta parte tiene cambios sin guardar (y deja de hacerlo al salir). */
function useReportUnsaved(report: ReportUnsaved, key: string, dirty: boolean) {
  useEffect(() => {
    report(key, dirty);
    return () => report(key, false);
  }, [report, key, dirty]);
}

function ResultBoard({
  report,
  teamId,
  teamName,
  match,
  candidates,
}: {
  report: ReportUnsaved;
  teamId: string;
  teamName: string;
  match: Match;
  candidates: RatablePlayer[];
}) {
  const save = useRecordMatchResult(teamId, match.id);
  const [goalsFor, setGoalsFor] = useState(match.result?.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(match.result?.goalsAgainst ?? 0);
  const [figureId, setFigureId] = useState<string | null>(match.result?.figure?.id ?? null);
  const [picking, setPicking] = useState(false);
  const figure =
    candidates.find((p) => p.playerId === figureId) ??
    (match.result?.figure && match.result.figure.id === figureId
      ? {
          playerId: match.result.figure.id,
          displayName: match.result.figure.displayName,
          jerseyNumber: match.result.figure.jerseyNumber,
        }
      : null);
  const dirty =
    !match.result ||
    match.result.goalsFor !== goalsFor ||
    match.result.goalsAgainst !== goalsAgainst ||
    (match.result.figure?.id ?? null) !== figureId;
  // Sin resultado guardado, 0 a 0 sin figura es "no tocó nada".
  useReportUnsaved(
    report,
    'result',
    goalsFor !== (match.result?.goalsFor ?? 0) ||
      goalsAgainst !== (match.result?.goalsAgainst ?? 0) ||
      figureId !== (match.result?.figure?.id ?? null),
  );

  return (
    <section aria-labelledby="resultado" className={styles.board}>
      <h2 id="resultado" className={styles.sectionTitle}>
        Resultado
      </h2>
      <div className={styles.score}>
        <Goals side={teamName} value={goalsFor} onChange={setGoalsFor} />
        <span className={styles.dash} aria-hidden="true">
          –
        </span>
        <Goals side={match.opponent ?? ''} value={goalsAgainst} onChange={setGoalsAgainst} />
      </div>

      <div className={styles.figure}>
        <div className={styles.figureWho}>
          <span className={styles.figureLabel}>Figura del partido</span>
          {figure ? (
            <span className={styles.figureName}>
              <Avatar name={figure.displayName} label={tokenText(figure)} size={32} />
              {figure.displayName}
            </span>
          ) : (
            <span className={styles.muted}>Sin elegir</span>
          )}
        </div>
        <button type="button" className={styles.textButton} onClick={() => setPicking(true)}>
          {figure ? 'Cambiar' : 'Elegir'}
        </button>
      </div>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Figura del partido">
        <ul className={styles.pickList}>
          {candidates.map((p) => (
            <li key={p.playerId}>
              <button
                type="button"
                className={styles.pick}
                aria-pressed={p.playerId === figureId}
                onClick={() => {
                  setFigureId(p.playerId);
                  setPicking(false);
                }}
              >
                <Avatar
                  name={p.displayName}
                  label={tokenText(p)}
                  size={32}
                  {...(p.playerId === figureId ? { ring: 'var(--sdl-accent)' } : {})}
                />
                <span>{p.displayName}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={styles.pick}
              aria-pressed={figureId === null}
              onClick={() => {
                setFigureId(null);
                setPicking(false);
              }}
            >
              Sin figura
            </button>
          </li>
        </ul>
      </Sheet>

      <Button
        busy={save.isPending}
        disabled={!dirty}
        onClick={() => save.mutate({ goalsFor, goalsAgainst, figurePlayerId: figureId })}
      >
        {match.result ? 'Guardar los cambios' : 'Guardar el resultado'}
      </Button>
      <p role="status" className={styles.saved}>
        {save.isSuccess && !dirty ? 'Resultado guardado. Lo ve todo el equipo.' : ''}
      </p>
      {save.isError && (
        <p role="alert" className={styles.error}>
          {failure(save.error, 'No pudimos guardar el resultado. Revisa tu conexión.')}
        </p>
      )}
    </section>
  );
}

/** Los goles de un lado; con `onChange`, con − y + para cargarlos. */
function Goals({
  side,
  value,
  onChange,
}: {
  side: string;
  value: number;
  onChange?: (value: number) => void;
}) {
  return (
    <div role="group" aria-label={`Goles de ${side}`} className={styles.goals}>
      <span className={styles.side}>{side}</span>
      {onChange ? (
        <output className={styles.number} aria-live="polite">
          {value}
        </output>
      ) : (
        <span className={styles.number}>{value}</span>
      )}
      {onChange && (
        <div className={styles.steppers}>
          <button
            type="button"
            className={styles.step}
            aria-label={`Un gol menos para ${side}`}
            disabled={value === 0}
            onClick={() => onChange(value - 1)}
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.step}
            aria-label={`Un gol más para ${side}`}
            disabled={value === 99}
            onClick={() => onChange(value + 1)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * El resultado para todo el equipo (D18): el marcador, la figura y, al jugador, cómo jugó si
 * el equipo lo muestra (sin la nota).
 */
export function MatchResultView({
  teamName,
  match,
  meId,
}: {
  teamName: string;
  match: Match;
  meId: string;
}) {
  const result = match.result;
  if (!result) {
    return <p className={styles.muted}>Todavía no cargaron el resultado.</p>;
  }
  const mine = result.figure?.id === meId;
  return (
    <section aria-labelledby="resultado" className={styles.board}>
      <h2 id="resultado" className={styles.sectionTitle}>
        Resultado
      </h2>
      <div className={styles.score}>
        <Goals side={teamName} value={result.goalsFor} />
        <span className={styles.dash} aria-hidden="true">
          –
        </span>
        <Goals side={match.opponent ?? ''} value={result.goalsAgainst} />
      </div>
      {result.figure && (
        <div className={styles.figure}>
          <div className={styles.figureWho}>
            <span className={styles.figureLabel}>Figura del partido</span>
            <span className={styles.figureName}>
              <Avatar name={result.figure.displayName} label={tokenText(result.figure)} size={32} />
              {result.figure.displayName}
            </span>
          </div>
        </div>
      )}
      {mine && <p className={styles.cheer}>¡Fuiste la figura del partido!</p>}
      {match.myRating !== null && (
        <div className={styles.mine}>
          <span className={styles.figureLabel}>Cómo jugaste</span>
          <span className={styles.mineRating}>{ratingLabel(match.myRating)}</span>
          <span className={styles.muted}>Es la mirada de tu cuerpo técnico.</span>
        </div>
      )}
    </section>
  );
}

/** Alguien a quien no evalúas tú (tú mismo u otro del cuerpo técnico): cómo le fue y por qué. */
function FixedRow({
  player,
  rating,
  why,
}: {
  player: RatablePlayer;
  rating: MatchRatingValue | null;
  why: string;
}) {
  return (
    <li className={styles.player}>
      <div className={styles.playerHead}>
        <Avatar name={player.displayName} label={tokenText(player)} size={32} />
        <span className={styles.playerName}>{player.displayName}</span>
        {rating !== null && <span className={styles.rowStatus}>{ratingLabel(rating)}</span>}
      </div>
      <p className={styles.muted}>{why}</p>
    </li>
  );
}

/** Un jugador: sus cinco palabras (se guarda al tocar) y la nota, que se abre aparte. */
function RatingRow({
  report,
  teamId,
  matchId,
  player,
  rating,
  note,
}: {
  report: ReportUnsaved;
  teamId: string;
  matchId: string;
  player: RatablePlayer;
  rating: MatchRatingValue | null;
  note: string | null;
}) {
  const rate = useRateMatchPlayer(teamId, matchId, player.playerId);
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [draft, setDraft] = useState(note ?? '');
  const noteId = useId();
  useReportUnsaved(report, `note-${player.playerId}`, draft.trim() !== (note ?? '').trim());
  // Mientras se guarda, se ve lo que tocó (sin esperar al servidor).
  const pending = rate.isPending ? rate.variables : undefined;
  const shown = pending === undefined ? rating : ((pending?.rating as MatchRatingValue) ?? null);

  return (
    <li className={styles.player}>
      <div className={styles.playerHead}>
        <Avatar name={player.displayName} label={tokenText(player)} size={32} />
        <span className={styles.playerName}>{player.displayName}</span>
        <span role="status" className={styles.rowStatus}>
          {rate.isPending ? 'Guardando…' : rate.isSuccess ? 'Guardada' : ''}
        </span>
      </div>
      <div role="group" aria-label={`Cómo jugó ${player.displayName}`} className={styles.scale}>
        {RATING_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={styles.option}
            aria-pressed={shown === o.value}
            onClick={() => {
              if (shown !== o.value) rate.mutate({ rating: o.value, note: note });
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {rate.isError && (
        <p role="alert" className={styles.error}>
          {failure(rate.error, 'No se guardó. Revisa tu conexión y toca de nuevo.')}
        </p>
      )}
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.textButton}
          aria-expanded={noteOpen}
          aria-controls={noteId}
          onClick={() => setNoteOpen(!noteOpen)}
        >
          {note ? 'Ver la nota' : 'Nota'}
        </button>
        {rating !== null && (
          <button
            type="button"
            className={styles.textButton}
            disabled={rate.isPending}
            // Con nota, se pregunta: quitar la evaluación también la borra.
            onClick={() => (note ? setConfirmRemove(true) : rate.mutate(null))}
          >
            No jugó
          </button>
        )}
      </div>
      <Sheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`¿${player.displayName} no jugó?`}
      >
        <div className={styles.note}>
          <p>Se quita su evaluación de este partido, con tu nota.</p>
          <Button
            variant="danger"
            busy={rate.isPending}
            onClick={() => rate.mutate(null, { onSuccess: () => setConfirmRemove(false) })}
          >
            Quitar la evaluación
          </Button>
          <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
            Dejarla
          </Button>
        </div>
      </Sheet>
      {noteOpen && (
        <div id={noteId} className={styles.note}>
          <label className={styles.noteLabel}>
            Nota para el cuerpo técnico
            <textarea
              className={styles.textarea}
              value={draft}
              maxLength={280}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          {rating === null ? (
            <p className={styles.muted}>Primero elige cómo jugó.</p>
          ) : (
            <Button
              variant="secondary"
              busy={rate.isPending}
              disabled={draft.trim() === (note ?? '')}
              onClick={() => rate.mutate({ rating, note: draft })}
            >
              Guardar la nota
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
