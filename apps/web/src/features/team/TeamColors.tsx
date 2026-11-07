import { APP_COLORS, posterPalette } from '@sdl/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type CSSProperties } from 'react';

import { Button } from '../../shared/ui/Button';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { SESSION_KEY } from '../auth/use-session';
import { useUpdateTeam } from '../card/use-card';
import { useTeam } from '../team-admin/use-invitations';
import pageStyles from './TeamPage.module.css';
import styles from './TeamColors.module.css';

/*
 * Los colores del equipo (2026-11-06, Kevin): dos o tres, los elige el cuerpo técnico y salen en
 * todos los afiches (alineación, resultado, tarjeta y podio). La vista previa usa la misma regla
 * que los afiches (`posterPalette`): si un color no se lee sobre el fondo, se ajusta solo.
 */

const PRESETS: readonly { name: string; colors: readonly string[] }[] = [
  { name: 'Rojo y blanco', colors: ['#c8102e', '#ffffff', '#111111'] },
  { name: 'Verde y amarillo', colors: ['#0b7a3b', '#ffd200', '#ffffff'] },
  { name: 'Azul y amarillo', colors: ['#0b2a7a', '#ffd200'] },
  { name: 'Negro y naranja', colors: ['#141414', '#ff7a00'] },
  { name: 'Vinotinto y celeste', colors: ['#6d1a36', '#8fd3ff', '#ffffff'] },
  { name: 'Blanco y azul', colors: ['#f4f6fb', '#1d3fbf'] },
];

const same = (a: readonly string[] | null, b: readonly string[] | null) =>
  (a ?? []).join() === (b ?? []).join();

/** Un afiche en miniatura con los colores: el marcador, la franja y el texto. */
function Preview({ colors }: { colors: readonly string[] | null }) {
  const p = posterPalette(colors);
  const vars = {
    '--bg': p.bg,
    '--fg': p.fg,
    '--soft': p.soft,
    '--accent': p.accent,
    '--band': p.band,
    '--on-band': p.onBand,
  } as CSSProperties;
  return (
    <div className={styles.preview} style={vars} aria-hidden="true">
      <span className={styles.previewTop}>Final · Liga del barrio</span>
      <span className={styles.previewScore}>
        3<span>–</span>1
      </span>
      <span className={styles.previewBand}>Ganamos</span>
      <span className={styles.previewFoot}>Siempre de Local</span>
    </div>
  );
}

export function TeamColors({ teamId, editable }: { teamId: string; editable: boolean }) {
  const team = useTeam(teamId);
  const [editing, setEditing] = useState(false);
  if (!team.data) return null;
  const colors = team.data.team.colors;
  return (
    <section aria-labelledby="colores" className={pageStyles.section}>
      <div className={pageStyles.sectionHead}>
        <h2 id="colores" className={pageStyles.sectionTitle}>
          Colores del equipo
        </h2>
        {editable && !editing && (
          <button type="button" className={pageStyles.textButton} onClick={() => setEditing(true)}>
            {colors ? 'Cambiar' : 'Elegir'}
          </button>
        )}
      </div>
      {editing ? (
        <ColorsForm teamId={teamId} initial={colors} onDone={() => setEditing(false)} />
      ) : (
        <div className={styles.summary}>
          <Preview colors={colors} />
          <p className={pageStyles.muted}>
            {colors
              ? 'Salen en los afiches que se mandan al grupo: alineación, resultado, tarjeta y podio.'
              : 'Los afiches salen con los colores de la app. Elige los del equipo para que salgan con su camiseta.'}
          </p>
        </div>
      )}
    </section>
  );
}

function ColorsForm({
  teamId,
  initial,
  onDone,
}: {
  teamId: string;
  initial: readonly string[] | null;
  onDone: () => void;
}) {
  const update = useUpdateTeam(teamId);
  const queryClient = useQueryClient();
  const [main, setMain] = useState(initial?.[0] ?? APP_COLORS[0]);
  const [second, setSecond] = useState(initial?.[1] ?? APP_COLORS[1]);
  const [third, setThird] = useState<string | null>(initial?.[2] ?? null);
  const ids = { main: useId(), second: useId(), third: useId() };
  const draft = third ? [main, second, third] : [main, second];
  const guard = useUnsavedChanges(
    !same(draft, initial ?? null) && !(initial === null && same(draft, APP_COLORS)),
  );

  function pick(colors: readonly string[]) {
    setMain(colors[0]!);
    setSecond(colors[1]!);
    setThird(colors[2] ?? null);
  }

  function save(colors: string[] | null) {
    update.mutate(
      { colors },
      {
        onSuccess: () => {
          // Los afiches los leen de la sesión (/me).
          void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
          guard.release();
          onDone();
        },
      },
    );
  }

  return (
    <div className={styles.form}>
      {guard.prompt}
      <div className={styles.presets} role="group" aria-label="Ejemplos">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className={styles.preset}
            aria-pressed={same(draft, preset.colors)}
            onClick={() => pick(preset.colors)}
          >
            <span className={styles.dots} aria-hidden="true">
              {preset.colors.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            {preset.name}
          </button>
        ))}
      </div>

      <div className={styles.picks}>
        <label className={styles.pick} htmlFor={ids.main}>
          <input
            id={ids.main}
            type="color"
            value={main}
            onChange={(e) => setMain(e.target.value)}
          />
          <span>
            Principal<small>El fondo</small>
          </span>
        </label>
        <label className={styles.pick} htmlFor={ids.second}>
          <input
            id={ids.second}
            type="color"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
          />
          <span>
            Secundario<small>Las cifras y los dorsales</small>
          </span>
        </label>
        {third ? (
          <div className={styles.pick}>
            <input
              id={ids.third}
              type="color"
              value={third}
              aria-label="Tercero"
              onChange={(e) => setThird(e.target.value)}
            />
            <span>
              <label htmlFor={ids.third}>Tercero</label>
              <button type="button" className={styles.remove} onClick={() => setThird(null)}>
                Quitar
              </button>
            </span>
          </div>
        ) : (
          <button type="button" className={styles.addThird} onClick={() => setThird('#ffffff')}>
            + Tercer color (opcional)
          </button>
        )}
      </div>

      <Preview colors={draft} />
      <p className={pageStyles.muted}>
        Si un color no se lee sobre el fondo, el afiche lo ajusta solo para que se pueda leer.
      </p>

      {update.isError && (
        <p role="alert" className={pageStyles.error}>
          No pudimos guardar los colores. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
      <div className={pageStyles.formActions}>
        <Button busy={update.isPending} onClick={() => save(draft)}>
          Guardar
        </Button>
        {initial && (
          <Button variant="secondary" disabled={update.isPending} onClick={() => save(null)}>
            Volver a los de la app
          </Button>
        )}
        <Button variant="ghost" disabled={update.isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
