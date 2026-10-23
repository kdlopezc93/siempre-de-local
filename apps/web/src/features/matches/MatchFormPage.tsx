import type { MatchFormat } from '@sdl/contracts';
import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { Segmented } from '../../shared/ui/Segmented';
import { FORMAT_LABEL } from '../shell/shell-nav';
import { fromLocalInputs, toLocalInputs } from './match-view';
import styles from './Matches.module.css';
import { useCreateMatch, useMatch, useUpdateMatch } from './use-matches';

/** /equipos/:teamId/partidos/nuevo y …/:matchId/editar — convocar o editar un partido. */
export function MatchFormPage({
  me,
  teamId,
  matchId,
}: {
  me: Me;
  teamId: string;
  matchId?: string;
}) {
  const team = me.teams.find((t) => t.team.id === teamId)?.team;
  if (!team) return null;
  return matchId ? (
    <EditMatch teamId={teamId} matchId={matchId} formats={team.formats} />
  ) : (
    <MatchForm
      teamId={teamId}
      formats={team.formats}
      initial={{ format: team.format, date: '', time: '', place: '', opponent: '' }}
    />
  );
}

function EditMatch({
  teamId,
  matchId,
  formats,
}: {
  teamId: string;
  matchId: string;
  formats: MatchFormat[];
}) {
  const data = useMatch(teamId, matchId);
  if (!data.data) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando el partido…
        </p>
      </Screen>
    );
  }
  const { match } = data.data;
  return (
    <MatchForm
      teamId={teamId}
      matchId={matchId}
      formats={formats}
      initial={{
        format: match.format,
        ...toLocalInputs(match.startsAt),
        place: match.place,
        opponent: match.opponent,
      }}
    />
  );
}

type Draft = { format: MatchFormat; date: string; time: string; place: string; opponent: string };

function MatchForm({
  teamId,
  matchId,
  formats,
  initial,
}: {
  teamId: string;
  matchId?: string;
  formats: MatchFormat[];
  initial: Draft;
}) {
  const navigate = useNavigate();
  const create = useCreateMatch(teamId);
  const update = useUpdateMatch(teamId, matchId ?? '');
  const save = matchId ? update : create;
  const [draft, setDraft] = useState<Draft>(initial);
  const [invalid, setInvalid] = useState<string | null>(null);
  const guard = useUnsavedChanges(
    (Object.keys(initial) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]),
  );
  const ids = { date: useId(), time: useId(), place: useId(), opponent: useId() };
  const set = (key: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startsAt = fromLocalInputs(draft.date, draft.time);
    if (!startsAt) return setInvalid('Pon la fecha y la hora del partido.');
    if (new Date(startsAt) <= new Date())
      return setInvalid('El partido tiene que ser más adelante.');
    if (!draft.opponent.trim()) return setInvalid('Escribe contra quién juegan.');
    if (!draft.place.trim()) return setInvalid('Escribe dónde juegan.');
    setInvalid(null);
    const request = {
      format: draft.format,
      startsAt,
      place: draft.place.trim(),
      opponent: draft.opponent.trim(),
    };
    save.mutate(request, {
      onSuccess: (data) => {
        guard.release();
        void navigate(`/equipos/${teamId}/partidos/${data.match.id}`, { replace: true });
      },
    });
  }

  const error =
    invalid ??
    (save.error instanceof ApiError && save.error.status < 500
      ? save.error.message
      : save.isError
        ? 'No pudimos guardar el partido. Revisa tu conexión e intenta de nuevo.'
        : null);

  return (
    <Screen className={styles.screen}>
      {guard.prompt}
      <Link
        to={matchId ? `/equipos/${teamId}/partidos/${matchId}` : `/equipos/${teamId}/partidos`}
        className={styles.back}
      >
        {matchId ? 'El partido' : 'Partidos'}
      </Link>
      <h1 className={styles.title}>{matchId ? 'Editar el partido' : 'Convocar partido'}</h1>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label htmlFor={ids.opponent} className={styles.label}>
          Rival
        </label>
        <input
          id={ids.opponent}
          name="opponent"
          autoComplete="off"
          maxLength={80}
          className={styles.input}
          placeholder="Ej.: Los Pibes de La 14…"
          value={draft.opponent}
          onChange={set('opponent')}
        />
        <div className={styles.twoCols}>
          <div className={styles.field}>
            <label htmlFor={ids.date} className={styles.label}>
              Fecha
            </label>
            <input
              id={ids.date}
              name="date"
              type="date"
              className={styles.input}
              value={draft.date}
              onChange={set('date')}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={ids.time} className={styles.label}>
              Hora
            </label>
            <input
              id={ids.time}
              name="time"
              type="time"
              className={styles.input}
              value={draft.time}
              onChange={set('time')}
            />
          </div>
        </div>
        <label htmlFor={ids.place} className={styles.label}>
          Lugar
        </label>
        <input
          id={ids.place}
          name="place"
          autoComplete="off"
          maxLength={80}
          className={styles.input}
          placeholder="Ej.: Cancha sintética del barrio…"
          value={draft.place}
          onChange={set('place')}
        />
        {formats.length > 1 && (
          <div className={styles.field}>
            <span className={styles.label}>Formato</span>
            <Segmented
              label="Formato"
              options={formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
              value={draft.format}
              onChange={(format) => setDraft((d) => ({ ...d, format }))}
            />
          </div>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" busy={save.isPending}>
          {matchId ? 'Guardar cambios' : 'Convocar'}
        </Button>
      </form>
    </Screen>
  );
}
