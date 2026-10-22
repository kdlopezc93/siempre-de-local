import type { Lineup, LineupInput, LineupInputsResponse, MatchFormat } from '@sdl/contracts';
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
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useTeam } from '../team-admin/use-invitations';
import { fitTone, LineupBoard } from './LineupBoard';
import styles from './PlannerPage.module.css';
import { fromLineup, toLineupInput } from './planner-state';
import { SlotBreakdown } from './SlotBreakdown';
import { useLineup, useSaveLineup } from './use-lineups';
import { useLineupInputs, usePlanner } from './use-planner';

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
const percent = (x: number) => `${Math.round(x * 100)}%`;

/** /equipos/:teamId/planificador — armar la alineación del partido (02 §9). */
export function PlannerPage({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const inputs = useLineupInputs(teamId);
  // ?alineacion=<id>: editar una guardada.
  const [params] = useSearchParams();
  const editingId = params.get('alineacion');
  const saved = useLineup(teamId, editingId);
  const back = (
    <Link to={`/equipos/${teamId}/plantilla`} className={styles.back}>
      Volver a la plantilla
    </Link>
  );
  if (team.isPending || inputs.isPending || (editingId && saved.isPending)) {
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
        <h1 className={styles.title}>Planificador</h1>
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
      inputs={inputs.data}
      back={back}
      saved={saved.data ?? null}
    />
  );
}

function Planner({
  teamId,
  teamName,
  inputs,
  back,
  saved,
}: {
  teamId: string;
  teamName: string;
  inputs: LineupInputsResponse;
  back: React.ReactNode;
  saved: Lineup | null;
}) {
  const p = usePlanner(
    inputs,
    saved
      ? fromLineup(
          saved,
          inputs.players.map((x) => x.playerId),
        )
      : undefined,
  );
  const { state, formation, result } = p;
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
      {back}
      <header>
        <h1 className={styles.title}>Planificador</h1>
        <p className={styles.muted}>{teamName}</p>
      </header>

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
                </label>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Formato del partido</legend>
        <div className={styles.chips}>
          {FORMATS.map((f) => (
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
              <dd>{lines[line] === null ? '–' : `${lines[line]}%`}</dd>
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
        toInput={(details) => toLineupInput(state, result, details)}
      />

      <p className={styles.note}>
        El encaje junta tu valoración, la tarjeta, el examen de conocimiento y el test (este último
        solo de quienes ya valoraste). Es una propuesta: tú decides.
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
  toInput,
}: {
  teamId: string;
  saved: Lineup | null;
  toInput: (details: { name: string; matchDate: string | null }) => LineupInput;
}) {
  const save = useSaveLineup(teamId);
  const [name, setName] = useState(saved?.name ?? `Partido del ${DAY_NAME.format(new Date())}`);
  const [date, setDate] = useState(saved?.matchDate ?? TODAY());
  const [done, setDone] = useState<Lineup | null>(null);
  // Tras guardar una nueva, los siguientes guardados la actualizan (no duplican).
  const currentId = done?.id ?? saved?.id ?? null;
  const nameId = useId();
  const dateId = useId();

  function persist(asNew: boolean) {
    if (!name.trim()) return;
    save.mutate(
      {
        input: toInput({ name, matchDate: date || null }),
        ...(currentId && !asNew ? { lineupId: currentId } : {}),
      },
      { onSuccess: setDone },
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
