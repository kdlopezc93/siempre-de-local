import type { LineupInputsResponse } from '@sdl/contracts';
import {
  DEFAULT_FORMATION,
  formationsFor,
  lineRatings,
  MODE_LABELS,
  POSITIONS,
  type FitMode,
  type LinePriority,
  type LineupWarning,
  type Signal,
} from '@sdl/domain';
import { Link } from 'react-router';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useTeam } from '../team-admin/use-invitations';
import { fitTone, LineupBoard } from './LineupBoard';
import styles from './PlannerPage.module.css';
import { useLineupInputs, usePlanner } from './use-planner';

const SIGNALS: { key: Signal; label: string }[] = [
  { key: 'V', label: 'Cuerpo técnico' },
  { key: 'R', label: 'Tarjeta' },
  { key: 'C', label: 'Conocimiento' },
  { key: 'A', label: 'Test' },
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
  const back = (
    <Link to={`/equipos/${teamId}/plantilla`} className={styles.back}>
      Volver a la plantilla
    </Link>
  );
  if (team.isPending || inputs.isPending) {
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
  return <Planner teamName={team.data.team.name} inputs={inputs.data} back={back} />;
}

function Planner({
  teamName,
  inputs,
  back,
}: {
  teamName: string;
  inputs: LineupInputsResponse;
  back: React.ReactNode;
}) {
  const p = usePlanner(inputs, DEFAULT_FORMATION[inputs.format]);
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
        <legend className={styles.legend}>Formación</legend>
        <div className={styles.chips}>
          {formationsFor(inputs.format).map((f) => (
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
              <ul className={styles.breakdown}>
                {SIGNALS.map(({ key, label }) => {
                  const v = detail.breakdown?.[key];
                  return (
                    <li key={key}>
                      <span>{label}</span>
                      <span className={styles.bar} aria-hidden="true">
                        <span style={{ transform: `scaleX(${v ?? 0})` }} />
                      </span>
                      <span className={styles.value}>
                        {v === undefined ? 'sin dato' : percent(v)}
                      </span>
                    </li>
                  );
                })}
              </ul>
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
