import type { Match, MatchRoster } from '@sdl/contracts';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../../shared/api/http';
import { Avatar } from '../../shared/ui/Avatar';
import { Button } from '../../shared/ui/Button';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { useTakeAttendance } from './use-matches';
import styles from './WhoCame.module.css';

export type ReportUnsaved = (key: string, dirty: boolean) => void;

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/**
 * "¿Quién vino?" (2026-10-30, `02` §13): el cuerpo técnico pasa lista desde la hora del
 * partido. Arranca con los que dijeron voy (o con la lista guardada), se marca y desmarca, y se
 * guarda entera; se corrige sin plazo. Manda en las evaluaciones y en los cobros.
 */
export function WhoCame({
  teamId,
  match,
  roster,
  report,
}: {
  teamId: string;
  match: Match;
  roster: MatchRoster;
  /** Para el aviso de cambios sin guardar de la pantalla (uno solo por pantalla). */
  report: ReportUnsaved;
}) {
  const take = useTakeAttendance(teamId, match.id);
  const saved = useMemo(
    () => new Set(roster.filter((p) => p.came).map((p) => p.playerId)),
    [roster],
  );
  const [came, setCame] = useState<ReadonlySet<string>>(saved);
  // Cuando llega la lista guardada (o la corrige otro), se parte de ella (sin efecto: se ajusta
  // al renderizar, como recomienda React para el estado que depende de una prop).
  const [base, setBase] = useState(saved);
  if (base !== saved) {
    setBase(saved);
    setCame(saved);
  }
  const dirty = !sameSet(came, saved);
  useEffect(() => {
    report('who-came', dirty);
    return () => report('who-came', false);
  }, [report, dirty]);

  const toggle = (id: string) =>
    setCame((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-labelledby="quien-vino" className={styles.section}>
      <div className={styles.head}>
        <h2 id="quien-vino" className={styles.title}>
          ¿Quién vino?
        </h2>
        <p className={styles.count} aria-live="polite">
          {came.size} de {roster.length}
        </p>
      </div>
      <p className={styles.hint}>
        {match.attendanceTaken
          ? 'Lista guardada. La corriges cuando quieras.'
          : 'Marcamos a los que dijeron “voy”. Corrige y guarda la lista.'}
      </p>
      <ul className={styles.list}>
        {roster.map((p) => (
          <li key={p.playerId}>
            <label className={styles.row}>
              <Avatar
                name={p.displayName}
                label={p.jerseyNumber !== null ? String(p.jerseyNumber) : initialsOf(p.displayName)}
                size={32}
                injured={p.injured}
              />
              <span className={styles.name}>
                {p.displayName}
                {p.injured && <span className="sr-only">, lesionado</span>}
              </span>
              <input
                type="checkbox"
                className={styles.check}
                checked={came.has(p.playerId)}
                onChange={() => toggle(p.playerId)}
              />
              <span className={styles.mark} aria-hidden="true">
                <Check size={18} weight="bold" />
              </span>
            </label>
          </li>
        ))}
      </ul>
      {take.isError && (
        <p role="alert" className={styles.error}>
          {take.error instanceof ApiError && take.error.status < 500
            ? take.error.message
            : 'No pudimos guardar la lista. Revisa tu conexión e intenta de nuevo.'}
        </p>
      )}
      {(dirty || !match.attendanceTaken) && (
        <Button busy={take.isPending} onClick={() => take.mutate([...came])}>
          Guardar la lista
        </Button>
      )}
    </section>
  );
}

/** En el entreno no hay nada más que guardar: la lista lleva su propio aviso. */
export function WhoCameAlone(props: { teamId: string; match: Match; roster: MatchRoster }) {
  const [dirty, setDirty] = useState(false);
  const report = useCallback<ReportUnsaved>((_key, value) => setDirty(value), []);
  const guard = useUnsavedChanges(dirty);
  return (
    <>
      {guard.prompt}
      <WhoCame {...props} report={report} />
    </>
  );
}
