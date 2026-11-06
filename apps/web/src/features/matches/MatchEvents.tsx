import type { CardColor, Match } from '@sdl/contracts';
import { useState } from 'react';

import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import type { RatablePlayer } from './after-match';
import styles from './MatchEvents.module.css';

/*
 * Goles, asistencias y tarjetas (2026-11-06, `08` etapa 1). El cuerpo técnico los carga en
 * "después del partido" con el marcador: una fila por gol a favor (el marcador manda) y las
 * tarjetas debajo. Los ve todo el equipo con el resultado.
 */

export interface GoalDraft {
  scorerId: string | null;
  assistId: string | null;
  ownGoal: boolean;
}
export interface CardDraft {
  playerId: string;
  color: CardColor;
}

type Person = Pick<RatablePlayer, 'playerId' | 'displayName' | 'jerseyNumber'>;

const EMPTY: GoalDraft = { scorerId: null, assistId: null, ownGoal: false };
const COLOR_LABEL: Record<CardColor, string> = { yellow: 'Amarilla', red: 'Roja' };

/** Los goles guardados, como borrador del editor. */
export const goalDrafts = (result: Match['result']): GoalDraft[] =>
  (result?.goals ?? []).map((g) => ({
    scorerId: g.scorer?.id ?? null,
    assistId: g.assist?.id ?? null,
    ownGoal: g.ownGoal,
  }));

export const cardDrafts = (result: Match['result']): CardDraft[] =>
  (result?.cards ?? []).map((c) => ({ playerId: c.player.id, color: c.color }));

/** Una fila por gol del marcador: los que faltan, "sin saber quién"; los que sobran, fuera. */
export const goalRows = (goals: readonly GoalDraft[], goalsFor: number): GoalDraft[] =>
  Array.from({ length: goalsFor }, (_, i) => goals[i] ?? EMPTY);

/** Los nombres de todos: los que vinieron y los que ya estaban guardados (aunque se hayan ido). */
export function peopleOf(candidates: readonly Person[], result: Match['result']) {
  const people = new Map(candidates.map((p) => [p.playerId, p]));
  const add = (p: { id: string; displayName: string; jerseyNumber: number | null } | null) => {
    if (p && !people.has(p.id)) {
      people.set(p.id, {
        playerId: p.id,
        displayName: p.displayName,
        jerseyNumber: p.jerseyNumber,
      });
    }
  };
  for (const g of result?.goals ?? []) {
    add(g.scorer);
    add(g.assist);
  }
  for (const c of result?.cards ?? []) add(c.player);
  return people;
}

const goalLine = (goal: GoalDraft, people: Map<string, Person>) => {
  if (goal.ownGoal) return { who: 'Autogol del rival', how: 'Sin asistencia' };
  const scorer = goal.scorerId ? people.get(goal.scorerId) : undefined;
  const assist = goal.assistId ? people.get(goal.assistId) : undefined;
  return {
    who: scorer?.displayName ?? '¿Quién lo hizo?',
    how: assist
      ? `Asistencia de ${assist.displayName}`
      : scorer
        ? 'Sin asistencia'
        : 'Se puede dejar sin saber',
  };
};

function Dorsal({ person }: { person: Person }) {
  return (
    <span className={styles.dorsal} aria-hidden="true">
      {person.jerseyNumber ?? person.displayName.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** El editor del cuerpo técnico: las filas de los goles y las tarjetas. */
export function MatchEventsEditor({
  goalsFor,
  goals,
  cards,
  candidates,
  people,
  onGoals,
  onCards,
}: {
  goalsFor: number;
  goals: readonly GoalDraft[];
  cards: readonly CardDraft[];
  /** Los que vinieron: de ahí se eligen. */
  candidates: readonly Person[];
  people: Map<string, Person>;
  onGoals: (goals: GoalDraft[]) => void;
  onCards: (cards: CardDraft[]) => void;
}) {
  const rows = goalRows(goals, goalsFor);
  const [editing, setEditing] = useState<number | null>(null);
  const [carding, setCarding] = useState<CardColor | null>(null);
  const setRow = (i: number, goal: GoalDraft) =>
    onGoals(rows.map((row, j) => (j === i ? goal : row)));

  return (
    <>
      {rows.length > 0 && (
        <ol className={styles.goals} aria-label="Goles a favor">
          {rows.map((goal, i) => {
            const line = goalLine(goal, people);
            const known = goal.ownGoal || goal.scorerId !== null;
            return (
              <li key={i} className={known ? undefined : styles.unknown}>
                <span className={styles.seq} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.goalText}>
                  <b>{line.who}</b>
                  <small>{line.how}</small>
                </span>
                <button
                  type="button"
                  className={styles.textButton}
                  aria-label={`${known ? 'Cambiar' : 'Elegir'} quién hizo el gol ${i + 1}`}
                  onClick={() => setEditing(i)}
                >
                  {known ? 'Cambiar' : 'Elegir'}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <section aria-labelledby="tarjetas" className={styles.cardsSection}>
        <h3 id="tarjetas" className={styles.title}>
          Tarjetas
        </h3>
        {cards.length > 0 && (
          <ul className={styles.cards}>
            {cards.map((card, i) => {
              const who = people.get(card.playerId)?.displayName ?? 'Alguien';
              return (
                <li key={`${card.playerId}-${card.color}-${i}`}>
                  <button
                    type="button"
                    className={styles.cardChip}
                    aria-label={`Quitar la ${COLOR_LABEL[card.color].toLowerCase()} de ${who}`}
                    onClick={() => onCards(cards.filter((_, j) => j !== i))}
                  >
                    <span className={styles.card} data-color={card.color} aria-hidden="true" />
                    {who}
                    <span aria-hidden="true" className={styles.remove}>
                      ×
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className={styles.cardButtons}>
          {(['yellow', 'red'] as const).map((color) => (
            <Button key={color} variant="secondary" onClick={() => setCarding(color)}>
              <span className={styles.card} data-color={color} aria-hidden="true" />
              {COLOR_LABEL[color]}
            </Button>
          ))}
        </div>
      </section>

      <GoalSheet
        index={editing}
        goal={editing === null ? EMPTY : rows[editing]!}
        candidates={candidates}
        onClose={() => setEditing(null)}
        onSave={(goal) => {
          if (editing !== null) setRow(editing, goal);
          setEditing(null);
        }}
      />
      <Sheet
        open={carding !== null}
        onClose={() => setCarding(null)}
        title={carding === 'red' ? 'Tarjeta roja' : 'Tarjeta amarilla'}
      >
        <ul className={styles.pickList}>
          {candidates.map((p) => (
            <li key={p.playerId}>
              <button
                type="button"
                className={styles.pick}
                onClick={() => {
                  if (carding) onCards([...cards, { playerId: p.playerId, color: carding }]);
                  setCarding(null);
                }}
              >
                <Dorsal person={p} />
                {p.displayName}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/** La hoja de un gol: primero quién lo hizo (o autogol del rival), después la asistencia. */
function GoalSheet({
  index,
  goal,
  candidates,
  onClose,
  onSave,
}: {
  index: number | null;
  goal: GoalDraft;
  candidates: readonly Person[];
  onClose: () => void;
  onSave: (goal: GoalDraft) => void;
}) {
  return (
    <Sheet open={index !== null} onClose={onClose} title={`Gol ${(index ?? 0) + 1}`}>
      {index !== null && (
        <GoalForm key={index} goal={goal} candidates={candidates} onSave={onSave} />
      )}
    </Sheet>
  );
}

function GoalForm({
  goal,
  candidates,
  onSave,
}: {
  goal: GoalDraft;
  candidates: readonly Person[];
  onSave: (goal: GoalDraft) => void;
}) {
  const [draft, setDraft] = useState(goal);
  const option = (pressed: boolean, label: string, onClick: () => void, person?: Person) => (
    <button
      type="button"
      className={styles.option}
      aria-pressed={pressed}
      onClick={onClick}
      key={person?.playerId ?? label}
    >
      {person && <Dorsal person={person} />}
      {label}
    </button>
  );
  return (
    <div className={styles.form}>
      <div role="group" aria-label="¿Quién lo hizo?" className={styles.optionGroup}>
        <span className={styles.label}>¿Quién lo hizo?</span>
        <div className={styles.options}>
          {candidates.map((p) =>
            option(
              draft.scorerId === p.playerId,
              p.displayName,
              () =>
                setDraft({
                  scorerId: p.playerId,
                  assistId: draft.assistId === p.playerId ? null : draft.assistId,
                  ownGoal: false,
                }),
              p,
            ),
          )}
          {option(draft.ownGoal, 'Autogol del rival', () =>
            setDraft({ scorerId: null, assistId: null, ownGoal: true }),
          )}
          {option(!draft.ownGoal && draft.scorerId === null, 'Sin saber', () => setDraft(EMPTY))}
        </div>
      </div>
      {draft.scorerId !== null && (
        <div role="group" aria-label="¿Quién le dio el pase?" className={styles.optionGroup}>
          <span className={styles.label}>¿Quién le dio el pase? (opcional)</span>
          <div className={styles.options}>
            {candidates
              .filter((p) => p.playerId !== draft.scorerId)
              .map((p) =>
                option(
                  draft.assistId === p.playerId,
                  p.displayName,
                  () => setDraft({ ...draft, assistId: p.playerId }),
                  p,
                ),
              )}
            {option(draft.assistId === null, 'Sin asistencia', () =>
              setDraft({ ...draft, assistId: null }),
            )}
          </div>
        </div>
      )}
      <Button onClick={() => onSave(draft)}>Listo</Button>
    </div>
  );
}

/** Para todo el equipo: quién hizo cada gol y las tarjetas del partido. */
export function MatchEventsView({ result }: { result: NonNullable<Match['result']> }) {
  if (result.goals.length === 0 && result.cards.length === 0) return null;
  return (
    <>
      {result.goals.length > 0 && (
        <ol className={styles.goals} aria-label="Goles a favor">
          {result.goals.map((g, i) => (
            <li key={i}>
              <span className={styles.seq} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.goalText}>
                <b>
                  {g.ownGoal ? 'Autogol del rival' : (g.scorer?.displayName ?? 'Sin saber quién')}
                </b>
                {g.assist && <small>Asistencia de {g.assist.displayName}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {result.cards.length > 0 && (
        <ul className={styles.cards} aria-label="Tarjetas">
          {result.cards.map((c, i) => (
            <li key={i} className={styles.cardChip}>
              <span className={styles.card} data-color={c.color} aria-hidden="true" />
              <span className="sr-only">{COLOR_LABEL[c.color]}: </span>
              {c.player.displayName}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
