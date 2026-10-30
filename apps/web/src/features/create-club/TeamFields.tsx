import type { MatchFormat } from '@sdl/contracts';
import { useId } from 'react';

import { Segmented } from '../../shared/ui/Segmented';
import switchStyles from '../../shared/ui/Switch.module.css';
import styles from './CreateClubPage.module.css';
import { CATEGORY_SUGGESTIONS } from './use-create-club';

export interface TeamFieldValues {
  name: string;
  category: string;
  format: MatchFormat;
  season: string;
  alsoPlays: boolean;
}

export const emptyTeam = (): TeamFieldValues => ({
  name: '',
  category: '',
  format: 'F8',
  season: String(new Date().getFullYear()),
  alsoPlays: true,
});

/** Lo que falta para crear el equipo, o null si está completo. */
export function teamProblem(team: TeamFieldValues): string | null {
  if (team.name.trim().length < 2) return 'Escribe el nombre del equipo.';
  if (team.season.trim().length < 4) return 'Escribe la temporada, por ejemplo 2026.';
  return null;
}

/** Lo que se manda al API: sin espacios de más y sin categoría vacía. */
export function teamRequest(team: TeamFieldValues) {
  return {
    name: team.name.trim(),
    category: team.category.trim() || undefined,
    format: team.format,
    season: team.season.trim(),
    alsoPlays: team.alsoPlays,
  };
}

/**
 * Los datos de un equipo nuevo (2026-10-29): nombre, categoría (con sugerencias), formato,
 * temporada y si quien lo crea también juega. Los usan Crear mi club y Nuevo equipo.
 */
export function TeamFields({
  value,
  onChange,
}: {
  value: TeamFieldValues;
  onChange: (value: TeamFieldValues) => void;
}) {
  const ids = { name: useId(), category: useId(), season: useId() };
  const set = (patch: Partial<TeamFieldValues>) => onChange({ ...value, ...patch });
  return (
    <>
      <label htmlFor={ids.name} className={styles.label}>
        Nombre del equipo
      </label>
      <input
        id={ids.name}
        className={styles.input}
        value={value.name}
        maxLength={60}
        autoComplete="off"
        placeholder="Ej.: Primer equipo"
        onChange={(event) => set({ name: event.target.value })}
      />
      <label htmlFor={ids.category} className={styles.label}>
        Categoría (opcional)
      </label>
      <input
        id={ids.category}
        className={styles.input}
        value={value.category}
        maxLength={40}
        autoComplete="off"
        placeholder="Ej.: Veteranos"
        onChange={(event) => set({ category: event.target.value })}
      />
      <div className={styles.suggestions} role="group" aria-label="Sugerencias de categoría">
        {CATEGORY_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={styles.suggestion}
            aria-pressed={value.category.trim() === s}
            onClick={() => set({ category: s })}
          >
            {s}
          </button>
        ))}
      </div>
      <span className={styles.label}>Formato</span>
      <Segmented
        label="Formato"
        options={[
          { value: 'F5', label: 'Fútbol 5' },
          { value: 'F8', label: 'Fútbol 8' },
          { value: 'F11', label: 'Fútbol 11' },
        ]}
        value={value.format}
        onChange={(format) => set({ format })}
      />
      <label htmlFor={ids.season} className={styles.label}>
        Temporada
      </label>
      <input
        id={ids.season}
        className={styles.input}
        value={value.season}
        maxLength={9}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => set({ season: event.target.value })}
      />
      <label className={styles.toggle}>
        <input
          type="checkbox"
          role="switch"
          className={switchStyles.switch}
          checked={value.alsoPlays}
          onChange={(event) => set({ alsoPlays: event.target.checked })}
        />
        <span>
          También juego en el equipo
          <span className={styles.hint}>
            {value.alsoPlays ? 'Eres entrenador y jugador.' : 'Solo entrenador.'}
          </span>
        </span>
      </label>
    </>
  );
}
