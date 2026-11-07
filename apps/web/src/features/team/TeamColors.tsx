import { APP_COLORS, posterPalette } from '@sdl/domain';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';

import { Button } from '../../shared/ui/Button';
import { useUnsavedChanges } from '../../shared/ui/UnsavedChanges';
import { SESSION_KEY } from '../auth/use-session';
import { useUpdateTeam } from '../card/use-card';
import { useTeam } from '../team-admin/use-invitations';
import { ColorPicker } from './ColorPicker';
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

const SLOT_NAME = ['Principal', 'Secundario', 'Tercero'] as const;
const SLOT_ROLE = ['el fondo', 'las cifras y los dorsales', 'la franja y las etiquetas'] as const;

/** Qué ajusta el afiche, en palabras: si un color no se lee sobre el fondo. */
function adjustments(colors: readonly string[]): string[] {
  const p = posterPalette(colors);
  const notes: string[] = [];
  if (p.accent !== colors[1]) {
    notes.push(
      `El secundario casi no se ve sobre el fondo: las cifras salen en ${p.fg === '#ffffff' ? 'blanco' : 'negro'}.`,
    );
  }
  if (colors[2] && p.band !== colors[2]) {
    notes.push('El tercero casi no se ve sobre el fondo: la franja usa el secundario.');
  }
  return notes;
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
  const [draft, setDraft] = useState<string[]>(() => [...(initial ?? APP_COLORS)]);
  const [active, setActive] = useState(0);
  const guard = useUnsavedChanges(
    !same(draft, initial ?? null) && !(initial === null && same(draft, APP_COLORS)),
  );
  const notes = adjustments(draft);

  const setColor = (hex: string) => setDraft((d) => d.map((c, i) => (i === active ? hex : c)));

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
      <div>
        <p className={styles.label}>Empieza con unos parecidos</p>
        <div className={styles.presets} role="group" aria-label="Ejemplos">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={styles.preset}
              aria-pressed={same(draft, preset.colors)}
              onClick={() => {
                setDraft([...preset.colors]);
                setActive(0);
              }}
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
      </div>

      <div className={styles.slots} role="group" aria-label="Los colores">
        {draft.map((color, i) => (
          <button
            key={i}
            type="button"
            className={styles.slot}
            aria-pressed={active === i}
            aria-label={`${SLOT_NAME[i]}, ${color.toUpperCase()}`}
            onClick={() => setActive(i)}
          >
            <span className={styles.swatch} style={{ background: color }} aria-hidden="true" />
            <span className={styles.slotName}>{SLOT_NAME[i]}</span>
            <code className={styles.slotCode}>{color.toUpperCase()}</code>
          </button>
        ))}
        {draft.length < 3 && (
          <button
            type="button"
            className={styles.add}
            onClick={() => {
              setDraft((d) => [...d, '#ffffff']);
              setActive(2);
            }}
          >
            <span aria-hidden="true">+</span>
            Tercer color
          </button>
        )}
      </div>

      <div className={styles.editor}>
        <div className={styles.editorHead}>
          <h3 className={styles.editorTitle}>
            {SLOT_NAME[active]}: {SLOT_ROLE[active]}
          </h3>
          {active === 2 && (
            <button
              type="button"
              className={styles.remove}
              onClick={() => {
                setDraft((d) => d.slice(0, 2));
                setActive(1);
              }}
            >
              Quitar
            </button>
          )}
        </div>
        <ColorPicker
          key={active}
          value={draft[active]!}
          onChange={setColor}
          label={SLOT_NAME[active]!}
        />
      </div>

      <div>
        <p className={styles.label}>Así salen los afiches</p>
        <Preview colors={draft} />
      </div>
      {notes.length > 0 && (
        <p className={pageStyles.muted} role="status">
          {notes.join(' ')}
        </p>
      )}

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
