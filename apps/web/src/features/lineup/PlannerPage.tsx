import type {
  Lineup,
  LineupInput,
  LineupInputsResponse,
  MatchFormat,
  MatchResponse,
} from '@sdl/contracts';
import {
  formationsFor,
  lineRatings,
  MODE_LABELS,
  POSITIONS,
  type FitMode,
  type LinePriority,
  type LineupWarning,
} from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { toLocalInputs } from '../matches/match-view';
import { useMatch } from '../matches/use-matches';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { useTeam } from '../team-admin/use-invitations';
import { fitTone, LineupBoard } from './LineupBoard';
import styles from './PlannerPage.module.css';
import { fromLineup, fromMatch, lineupSignature, toLineupInput } from './planner-state';
import { SlotBreakdown } from './SlotBreakdown';
import { useLineup, usePublishLineup, useSaveLineup } from './use-lineups';
import { healthyIds, useLineupInputs, usePlanner } from './use-planner';
import { percent } from '../../shared/format';
import { PageTitle } from '../../shared/ui/PageTitle';

const FORMATS: { value: MatchFormat; label: string }[] = [
  { value: 'F11', label: 'Fútbol 11' },
  { value: 'F8', label: 'Fútbol 8' },
];
const PRIORITIES: { value: LinePriority; label: string }[] = [
  { value: 'none', label: 'Ninguna' },
  { value: 'defensa', label: 'Defensa' },
  { value: 'ataque', label: 'Ataque' },
];
const MIN_KNOWLEDGE: { value: number | null; label: string }[] = [
  { value: null, label: 'Sin mínimo' },
  { value: 0.5, label: '50%' },
  { value: 0.7, label: '70%' },
  { value: 0.85, label: '85%' },
];
const REPLY_LABEL = { yes: 'Va', no: 'No va', pending: 'Sin responder' } as const;

/** /equipos/:teamId/planificador — armar la alineación del partido (02 §9). */
export function PlannerPage({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const inputs = useLineupInputs(teamId);
  // ?alineacion=<id>: editar una guardada.
  const [params] = useSearchParams();
  const editingId = params.get('alineacion');
  const saved = useLineup(teamId, editingId);
  // ?partido=<id>: armar la de un partido (Fase 7); una guardada de un partido trae el suyo.
  const matchId = params.get('partido') ?? saved.data?.matchId ?? null;
  const match = useMatch(teamId, matchId);
  const back = matchId ? (
    <Link to={`/equipos/${teamId}/partidos/${matchId}`} className={styles.back}>
      El partido
    </Link>
  ) : (
    <Link to={`/equipos/${teamId}/alineaciones`} className={styles.back}>
      Alineaciones
    </Link>
  );
  if (
    team.isPending ||
    inputs.isPending ||
    (editingId && saved.isPending) ||
    (matchId && match.isPending)
  ) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando la plantilla…
        </p>
      </Screen>
    );
  }
  if (team.isError || inputs.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert">
          No pudimos cargar la plantilla. Ábrelo una vez con señal y después funciona sin ella.
        </p>
      </Screen>
    );
  }
  if (inputs.data.players.length === 0) {
    return (
      <Screen className={styles.screen}>
        {back}
        <PageTitle title="Planificador" />
        <p className={styles.muted}>
          Todavía no hay jugadores.{' '}
          <Link to={`/equipos/${teamId}/invitar`}>Invita a tu equipo</Link>.
        </p>
      </Screen>
    );
  }
  return (
    <Planner
      teamId={teamId}
      teamName={team.data.team.name}
      formats={team.data.team.formats}
      inputs={inputs.data}
      back={back}
      saved={saved.data ?? null}
      match={match.data ?? null}
    />
  );
}

function Planner({
  teamId,
  teamName,
  formats,
  inputs,
  back,
  saved,
  match,
}: {
  teamId: string;
  teamName: string;
  formats: readonly MatchFormat[];
  inputs: LineupInputsResponse;
  back: React.ReactNode;
  saved: Lineup | null;
  match: MatchResponse | null;
}) {
  const matchFormats = FORMATS.filter((f) => formats.includes(f.value));
  const ids = inputs.players.map((x) => x.playerId);
  const p = usePlanner(
    inputs,
    saved
      ? fromLineup(saved, ids)
      : match
        ? fromMatch(match.match, match.roster, healthyIds(inputs))
        : undefined,
  );
  const replies = new Map(match?.roster?.map((r) => [r.playerId, r.reply]));
  const { state, formation, result } = p;
  // Sin guardar: lo de la pizarra difiere de lo que se abrió o de lo último guardado.
  const signature = lineupSignature(state, result);
  const [savedSignature, setSavedSignature] = useState(signature);
  const guard = useUnsavedChanges(signature !== savedSignature);
  const names = new Map(inputs.players.map((x) => [x.playerId, x.displayName]));
  const jerseys = new Map(inputs.players.map((x) => [x.playerId, x.jerseyNumber]));
  const pinnedSlots = new Set(state.pins.map((x) => x.slotId));
  const lines = lineRatings(formation, result.assignments);
  const selectedSlot = state.selected?.kind === 'slot' ? state.selected.slotId : null;
  const armedPlayer = state.selected?.kind === 'bench' ? state.selected.playerId : null;
  const detail = selectedSlot ? result.assignments.find((a) => a.slotId === selectedSlot)! : null;
  const detailSlot = selectedSlot ? formation.slots.find((s) => s.id === selectedSlot)! : null;

  return (
    <Screen className={styles.screen}>
      {guard.prompt}
      {back}
      <PageTitle eyebrow={teamName} title="Planificador" />

      <details className={styles.call}>
        <summary className={styles.summary}>
          Convocatoria: {state.available.size} de {inputs.players.length}
        </summary>
        <div className={styles.callBody}>
          <Button variant="ghost" onClick={p.callAll}>
            Convocar a todos
          </Button>
          <ul className={styles.callList}>
            {inputs.players.map((x) => (
              <li key={x.playerId}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={state.available.has(x.playerId)}
                    onChange={() => p.toggleAvailable(x.playerId)}
                  />
                  <span>
                    {x.jerseyNumber !== null && (
                      <span className={styles.jersey}>{x.jerseyNumber} </span>
                    )}
                    {x.displayName}
                  </span>
                  {x.injured && <span className={styles.injuredTag}>Lesionado</span>}
                  {match?.roster && (
                    <span className={styles.replyTag}>
                      {REPLY_LABEL[replies.get(x.playerId) ?? 'pending']}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* Solo si el equipo juega más de un formato (D14); una guardada conserva el suyo. */}
      {matchFormats.length > 1 && (
        <fieldset className={styles.choices}>
          <legend className={styles.legend}>Formato del partido</legend>
          <div className={styles.chips}>
            {matchFormats.map((f) => (
              <label key={f.value} className={styles.chip}>
                <input
                  type="radio"
                  name="format"
                  checked={state.format === f.value}
                  onChange={() => p.setFormat(f.value)}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Formación</legend>
        <div className={styles.chips}>
          {formationsFor(state.format).map((f) => (
            <label key={f.key} className={styles.chip}>
              <input
                type="radio"
                name="formation"
                checked={state.formationKey === f.key}
                onChange={() => p.setFormation(f.key)}
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Qué pesa más</legend>
        <div className={styles.chips}>
          {(Object.keys(MODE_LABELS) as FitMode[]).map((mode) => (
            <label key={mode} className={styles.chip}>
              <input
                type="radio"
                name="mode"
                checked={state.mode === mode}
                onChange={() => p.setMode(mode)}
              />
              <span>{MODE_LABELS[mode]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <details className={styles.more}>
        <summary className={styles.summary}>Más opciones</summary>
        <fieldset className={styles.choices}>
          <legend className={styles.legend}>Armar primero la línea</legend>
          <div className={styles.chips}>
            {PRIORITIES.map((x) => (
              <label key={x.value} className={styles.chip}>
                <input
                  type="radio"
                  name="priority"
                  checked={state.priority === x.value}
                  onChange={() => p.setPriority(x.value)}
                />
                <span>{x.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.choices}>
          <legend className={styles.legend}>Conocimiento mínimo para jugar en un puesto</legend>
          <div className={styles.chips}>
            {MIN_KNOWLEDGE.map((x) => (
              <label key={x.label} className={styles.chip}>
                <input
                  type="radio"
                  name="min-knowledge"
                  checked={state.minKnowledgePct === x.value}
                  onChange={() => p.setMinKnowledge(x.value)}
                />
                <span>{x.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </details>

      <section aria-labelledby="pizarra" className={styles.section}>
        <h2 id="pizarra" className="sr-only">
          Pizarra
        </h2>
        <p className={styles.hint} aria-live="polite">
          {armedPlayer
            ? `Toca el puesto donde va a jugar ${names.get(armedPlayer)}.`
            : selectedSlot
              ? 'Toca otro puesto para intercambiarlos.'
              : 'Toca un jugador y después otro puesto para cambiarlo. Lo que muevas queda fijado.'}
        </p>
        <LineupBoard
          formation={formation}
          assignments={result.assignments}
          names={names}
          jerseys={jerseys}
          pinned={pinnedSlots}
          selectedSlot={selectedSlot}
          armed={armedPlayer !== null}
          onTap={p.tapSlot}
        />
        <dl className={styles.lines}>
          {(['defensa', 'medio', 'ataque'] as const).map((line) => (
            <div key={line}>
              <dt>{line[0]!.toUpperCase() + line.slice(1)}</dt>
              <dd>{lines[line] === null ? '–' : `${lines[line]}\u00a0%`}</dd>
            </div>
          ))}
        </dl>
      </section>

      {detail && detailSlot && (
        <section aria-labelledby="puesto" className={styles.detail}>
          <h2 id="puesto" className={styles.sectionTitle}>
            {POSITIONS[detailSlot.position].name}
            {detailSlot.side ? ` ${detailSlot.side}` : ''}
          </h2>
          {detail.playerId ? (
            <>
              <p className={styles.detailHead}>
                <span>{names.get(detail.playerId)}</span>
                <span className={styles[fitTone(detail.fit)]}>
                  {percent(detail.fit ?? 0)} de encaje
                </span>
              </p>
              <SlotBreakdown breakdown={detail.breakdown} />
              <div className={styles.detailActions}>
                {pinnedSlots.has(detailSlot.id) && (
                  <Button variant="secondary" onClick={() => p.unpin(detailSlot.id)}>
                    Soltar
                  </Button>
                )}
                <Button variant="ghost" onClick={() => p.sendToBench(detail.playerId!)}>
                  Mandar a la banca
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.muted}>Nadie disponible para este puesto.</p>
          )}
        </section>
      )}

      <section aria-labelledby="banca" className={styles.section}>
        <h2 id="banca" className={styles.sectionTitle}>
          Suplentes ({result.bench.length})
        </h2>
        {result.bench.length === 0 ? (
          <p className={styles.muted}>Todos los convocados están en la cancha.</p>
        ) : (
          <ul className={styles.bench}>
            {result.bench.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className={styles.benchItem}
                  aria-pressed={armedPlayer === id}
                  onClick={() => p.tapBench(id)}
                >
                  {jerseys.get(id) != null && (
                    <span className={styles.jersey}>{jerseys.get(id)} </span>
                  )}
                  {names.get(id)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result.warnings.length > 0 && (
        <section aria-labelledby="avisos" className={styles.section}>
          <h2 id="avisos" className={styles.sectionTitle}>
            Ojo
          </h2>
          <ul className={styles.warnings}>
            {warningTexts(result.warnings, names, formation).map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>
      )}

      <SaveSection
        teamId={teamId}
        saved={saved}
        match={match}
        toInput={(details) => toLineupInput(state, result, details)}
        onSaved={() => setSavedSignature(signature)}
      />

      <p className={styles.note}>
        Es una propuesta: tú decides. Toca un puesto para ver de dónde sale su encaje.
      </p>
    </Screen>
  );
}

function warningTexts(
  warnings: readonly LineupWarning[],
  names: ReadonlyMap<string, string>,
  formation: ReturnType<typeof usePlanner>['formation'],
): string[] {
  const slotName = (slotId: string) => {
    const s = formation.slots.find((x) => x.id === slotId)!;
    return POSITIONS[s.position].name.toLowerCase();
  };
  const texts = new Set<string>();
  for (const w of warnings) {
    if (w.code === 'NOT_ENOUGH_PLAYERS') {
      texts.add(
        `Faltan ${w.missing} ${w.missing === 1 ? 'jugador' : 'jugadores'} para completar la formación.`,
      );
    } else if (w.code === 'PLAYER_WITHOUT_DATA') {
      texts.add(`${names.get(w.playerId)} no tiene test, valoración ni tarjeta: va de último.`);
    } else if (w.code === 'MIN_KNOWLEDGE_INFEASIBLE') {
      texts.add(
        `En ${slotName(w.slotId)} nadie llega al conocimiento mínimo: va el que mejor encaja.`,
      );
    } else {
      texts.add(
        `${names.get(w.playerId)} tiene una re-evaluación vencida de ${slotName(w.slotId)}: ahí su conocimiento cuenta 0.`,
      );
    }
  }
  return [...texts];
}

const TODAY = () => new Date().toLocaleDateString('en-CA');
const DAY_NAME = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });

/** Guardar lo armado: nombre y fecha del partido; al editar, cambios o una nueva. */
function SaveSection({
  teamId,
  saved,
  match,
  toInput,
  onSaved,
}: {
  teamId: string;
  saved: Lineup | null;
  match: MatchResponse | null;
  onSaved: () => void;
  toInput: (details: {
    name: string;
    matchDate: string | null;
    matchId: string | null;
  }) => LineupInput;
}) {
  const save = useSaveLineup(teamId);
  const publish = usePublishLineup(teamId);
  const [name, setName] = useState(
    saved?.name ??
      (match ? `vs ${match.match.opponent}` : `Partido del ${DAY_NAME.format(new Date())}`),
  );
  const [date, setDate] = useState(
    saved?.matchDate ?? (match ? toLocalInputs(match.match.startsAt).date : TODAY()),
  );
  const [done, setDone] = useState<Lineup | null>(null);
  // Tras guardar una nueva, los siguientes guardados la actualizan (no duplican).
  const currentId = done?.id ?? saved?.id ?? null;
  const nameId = useId();
  const dateId = useId();

  function persist(asNew: boolean) {
    if (!name.trim()) return;
    save.mutate(
      {
        input: toInput({
          name,
          matchDate: date || null,
          matchId: match?.match.id ?? saved?.matchId ?? null,
        }),
        ...(currentId && !asNew ? { lineupId: currentId } : {}),
      },
      {
        onSuccess: (lineup) => {
          setDone(lineup);
          onSaved();
        },
      },
    );
  }

  return (
    <section aria-labelledby="guardar" className={styles.section}>
      <h2 id="guardar" className={styles.sectionTitle}>
        Guardar
      </h2>
      {saved && (
        <p className={styles.muted}>
          Abriste “{saved.name}” tal cual se guardó: todos quedaron fijados. Suelta los que quieras
          recalcular.
        </p>
      )}
      <form
        className={styles.save}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          persist(false);
        }}
      >
        <label htmlFor={nameId} className={styles.legend}>
          Nombre
        </label>
        <input
          id={nameId}
          name="name"
          autoComplete="off"
          maxLength={80}
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor={dateId} className={styles.legend}>
          Fecha del partido
        </label>
        <input
          id={dateId}
          name="date"
          type="date"
          className={styles.input}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {save.isError && (
          <p role="alert" className={styles.error}>
            {save.error instanceof ApiError && save.error.status < 500
              ? save.error.message
              : 'No pudimos guardarla. Si estás sin señal, déjala abierta y guárdala cuando vuelva.'}
          </p>
        )}
        {done && !save.isPending && (
          <p role="status" className={styles.ok}>
            Guardada. <Link to={`/equipos/${teamId}/alineaciones/${done.id}`}>Verla</Link>
          </p>
        )}
        {match?.match.open && currentId && (
          <PublishButton
            published={match.match.published?.lineupId === currentId || publish.isSuccess}
            busy={publish.isPending}
            failed={publish.isError}
            onPublish={() => publish.mutate(currentId)}
          />
        )}
        <div className={styles.saveActions}>
          <Button type="submit" busy={save.isPending} disabled={!name.trim()}>
            {currentId ? 'Guardar cambios' : 'Guardar alineación'}
          </Button>
          {currentId && (
            <Button
              variant="ghost"
              disabled={save.isPending || !name.trim()}
              onClick={() => persist(true)}
            >
              Guardar como nueva
            </Button>
          )}
        </div>
      </form>
      <Link to={`/equipos/${teamId}/alineaciones`} className={styles.back}>
        Ver las alineaciones guardadas
      </Link>
    </section>
  );
}

/** Publicar para el equipo (D17): se puede republicar hasta la hora del partido. */
function PublishButton({
  published,
  busy,
  failed,
  onPublish,
}: {
  published: boolean;
  busy: boolean;
  failed: boolean;
  onPublish: () => void;
}) {
  return (
    <div className={styles.publish}>
      <Button variant="secondary" busy={busy} onClick={onPublish}>
        {published ? 'Republicar con estos cambios' : 'Publicar para el equipo'}
      </Button>
      <p className={failed ? styles.error : styles.muted} role={failed ? 'alert' : 'status'}>
        {failed
          ? 'No pudimos publicarla. Revisa tu conexión e intenta de nuevo.'
          : published
            ? 'Publicada: el equipo ya la ve. Guarda los cambios antes de republicar.'
            : 'El equipo la verá sin poder cambiarla. Puedes republicar hasta la hora del partido.'}
      </p>
    </div>
  );
}
