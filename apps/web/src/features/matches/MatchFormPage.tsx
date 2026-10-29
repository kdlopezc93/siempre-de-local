import type { MatchFormat, MatchKind } from '@sdl/contracts';
import { matchKindProblem } from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Chips } from '../../shared/ui/Chips';
import { Screen } from '../../shared/ui/Screen';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { Segmented } from '../../shared/ui/Segmented';
import { FORMAT_LABEL } from '../shell/shell-nav';
import { fromLocalInputs, matchWhen, toLocalInputs } from './match-view';
import styles from './Matches.module.css';
import {
  useCreateMatch,
  useCreateTournament,
  useMatch,
  useTournaments,
  useUpdateMatch,
} from './use-matches';
import { PageTitle } from '../../shared/ui/PageTitle';

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
      initial={{
        kind: 'championship',
        tournamentId: '',
        format: team.format,
        date: '',
        time: '',
        place: '',
        opponent: '',
      }}
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
      // Ya pasó la hora (sin resultado): se corrige también a otra hora pasada.
      started={!match.open}
      initial={{
        kind: match.kind,
        tournamentId: match.tournament?.id ?? '',
        format: match.format,
        ...toLocalInputs(match.startsAt),
        place: match.place,
        opponent: match.opponent ?? '',
      }}
    />
  );
}

type Draft = {
  kind: MatchKind;
  /** '' sin elegir; NEW_TOURNAMENT si va a crear uno con `newTournament`. */
  tournamentId: string;
  format: MatchFormat;
  date: string;
  time: string;
  place: string;
  opponent: string;
};

const KINDS = [
  { value: 'championship', label: 'Campeonato' },
  { value: 'friendly', label: 'Amistoso' },
  { value: 'training', label: 'Entreno' },
] as const;

/** El chip "Nuevo torneo": abre el campo para escribir su nombre. */
const NEW_TOURNAMENT = 'nuevo';

function MatchForm({
  teamId,
  matchId,
  formats,
  initial,
  started = false,
}: {
  teamId: string;
  matchId?: string;
  formats: MatchFormat[];
  initial: Draft;
  started?: boolean;
}) {
  const navigate = useNavigate();
  const create = useCreateMatch(teamId);
  const update = useUpdateMatch(teamId, matchId ?? '');
  const newTournament = useCreateTournament(teamId);
  const tournaments = useTournaments(teamId);
  const save = matchId ? update : create;
  const [draft, setDraft] = useState<Draft>(initial);
  const [tournamentName, setTournamentName] = useState('');
  const training = draft.kind === 'training';
  const championship = draft.kind === 'championship';
  const known = tournaments.data?.items ?? [];
  // Sin torneos todavía, el campo del nuevo se muestra de una.
  const creatingTournament =
    championship &&
    (draft.tournamentId === NEW_TOURNAMENT || (known.length === 0 && !draft.tournamentId));
  const [invalid, setInvalid] = useState<string | null>(null);
  const guard = useUnsavedChanges(
    (Object.keys(initial) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]),
  );
  const ids = {
    date: useId(),
    time: useId(),
    when: useId(),
    place: useId(),
    opponent: useId(),
    tournament: useId(),
  };
  const set = (key: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startsAt = fromLocalInputs(draft.date, draft.time);
    const what = training ? 'entreno' : 'partido';
    if (!startsAt) return setInvalid(`Pon la fecha y la hora del ${what}.`);
    if (!started && new Date(startsAt) <= new Date())
      return setInvalid(`El ${what} tiene que ser más adelante.`);
    if (!training && !draft.opponent.trim()) return setInvalid('Escribe contra quién juegan.');
    if (creatingTournament && !tournamentName.trim())
      return setInvalid('Escribe el nombre del torneo.');
    if (!draft.place.trim()) return setInvalid('Escribe dónde juegan.');
    setInvalid(null);
    let tournamentId: string | null = championship ? draft.tournamentId || null : null;
    if (creatingTournament) {
      try {
        tournamentId = (await newTournament.mutateAsync(tournamentName.trim())).tournament.id;
      } catch {
        return;
      }
    }
    const fields = {
      kind: draft.kind,
      format: draft.format,
      startsAt,
      place: draft.place.trim(),
      opponent: training ? null : draft.opponent.trim(),
      tournamentId,
    };
    // Las mismas reglas que el API: así el error sale aquí, en palabras.
    const problem = matchKindProblem(fields);
    if (problem) return setInvalid(problem);
    const onSuccess = (data: { match: { id: string } }) => {
      guard.release();
      void navigate(`/equipos/${teamId}/partidos/${data.match.id}`, { replace: true });
    };
    if (matchId) update.mutate(fields, { onSuccess });
    else create.mutate(fields, { onSuccess });
  }

  // La hora en palabras, para que no se cuele un a. m. por un p. m. (2026-10-25).
  const when = fromLocalInputs(draft.date, draft.time);

  const failed = newTournament.error ?? save.error;
  const error =
    invalid ??
    (failed instanceof ApiError && failed.status < 500
      ? failed.message
      : failed
        ? 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.'
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
      <PageTitle
        eyebrow={matchId ? 'Editar' : 'Convocar'}
        title={training ? 'entreno' : matchId ? 'el partido' : 'partido nuevo'}
      />
      <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        <div className={styles.field}>
          <span className={styles.label}>Tipo</span>
          <Segmented
            label="Tipo de convocatoria"
            options={KINDS}
            value={draft.kind}
            onChange={(kind) => setDraft((d) => ({ ...d, kind }))}
          />
        </div>
        {championship && (
          <div className={styles.field}>
            <span className={styles.label} id={ids.tournament}>
              Torneo
            </span>
            {known.length > 0 && (
              <Chips
                label="Torneo"
                options={[
                  ...known.map((t) => ({ value: t.id, label: t.name })),
                  { value: NEW_TOURNAMENT, label: 'Nuevo torneo' },
                ]}
                selected={new Set([draft.tournamentId])}
                onToggle={(tournamentId) => setDraft((d) => ({ ...d, tournamentId }))}
              />
            )}
            {creatingTournament && (
              <input
                name="tournament"
                aria-labelledby={ids.tournament}
                autoComplete="off"
                maxLength={80}
                className={styles.input}
                placeholder="Ej.: Liga del barrio 2026…"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
              />
            )}
          </div>
        )}
        {!training && (
          <>
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
          </>
        )}
        <div className={styles.twoCols}>
          <div className={styles.field}>
            <label htmlFor={ids.date} className={styles.label}>
              Fecha
            </label>
            <input
              id={ids.date}
              name="date"
              type="date"
              aria-describedby={ids.when}
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
              aria-describedby={ids.when}
              className={styles.input}
              value={draft.time}
              onChange={set('time')}
            />
          </div>
        </div>
        <p id={ids.when} className={styles.muted} aria-live="polite">
          {when && `Queda para el ${matchWhen(when)}.`}
        </p>
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
        <Button type="submit" busy={save.isPending || newTournament.isPending}>
          {matchId ? 'Guardar cambios' : 'Convocar'}
        </Button>
      </form>
    </Screen>
  );
}
