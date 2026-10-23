import type { UpdateTeamRequest } from '@sdl/contracts';

import { useUpdateTeam } from '../card/use-card';
import { useTeam } from '../team-admin/use-invitations';
import styles from './TeamPage.module.css';

type Setting = 'ratingsVisibleToPlayers' | 'matchRatingsVisibleToPlayers';

const SETTINGS: readonly { key: Setting; title: string; on: string; off: string }[] = [
  {
    key: 'ratingsVisibleToPlayers',
    title: 'Los jugadores ven su tarjeta',
    on: 'Cada uno ve la suya, sin tus notas.',
    off: 'Solo el cuerpo técnico la ve.',
  },
  {
    key: 'matchRatingsVisibleToPlayers',
    title: 'Los jugadores ven cómo jugaron cada partido',
    on: 'Cada uno ve su evaluación, sin tus notas.',
    off: 'Solo el cuerpo técnico las ve.',
  },
];

/** Qué ven los jugadores: su tarjeta (D8) y su evaluación de cada partido (D18). */
export function VisibilitySettings({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const update = useUpdateTeam(teamId);
  if (!team.data) return null;
  const changing = update.isPending ? (update.variables as UpdateTeamRequest) : {};
  return (
    <section aria-labelledby="ajustes" className={styles.section}>
      <h2 id="ajustes" className={styles.sectionTitle}>
        Ajustes
      </h2>
      {SETTINGS.map(({ key, title, on, off }) => {
        const visible = changing[key] ?? team.data.team[key];
        return (
          <label key={key} className={styles.setting}>
            <input
              type="checkbox"
              role="switch"
              checked={visible}
              disabled={update.isPending}
              onChange={(event) => update.mutate({ [key]: event.target.checked })}
            />
            <span>
              {title}
              <span className={styles.settingHint}>{visible ? on : off}</span>
            </span>
          </label>
        );
      })}
      {update.isError && (
        <p role="alert" className={styles.error}>
          No pudimos cambiar el ajuste. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </section>
  );
}
