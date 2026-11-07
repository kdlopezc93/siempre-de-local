import type { UpdateTeamRequest } from '@sdl/contracts';

import { useUpdateTeam } from '../card/use-card';
import { useTeam } from '../team-admin/use-invitations';
import switchStyles from '../../shared/ui/Switch.module.css';
import styles from './TeamPage.module.css';

type Setting = 'ratingsVisibleToPlayers' | 'matchRatingsVisibleToPlayers' | 'callUpReminders';
type SettingCopy = { key: Setting; title: string; on: string; off: string };

const SETTINGS: readonly SettingCopy[] = [
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

/** El recordatorio de la convocatoria (2026-11-06). */
const REMINDERS: readonly SettingCopy[] = [
  {
    key: 'callUpReminders',
    title: 'Recordar a los que no han respondido',
    on: 'La noche antes y 3 horas antes del partido o entreno.',
    off: 'Solo cuando toques "Recordarles ahora".',
  },
];

/** Qué ven los jugadores: su tarjeta (D8) y su evaluación de cada partido (D18). */
export function VisibilitySettings({ teamId }: { teamId: string }) {
  return (
    <SwitchSection teamId={teamId} id="ajustes" title="Qué ven los jugadores" settings={SETTINGS} />
  );
}

/** Los avisos del equipo: el recordatorio de la convocatoria (2026-11-06). */
export function ReminderSettings({ teamId }: { teamId: string }) {
  return <SwitchSection teamId={teamId} id="avisos" title="Avisos" settings={REMINDERS} />;
}

function SwitchSection({
  teamId,
  id,
  title: sectionTitle,
  settings,
}: {
  teamId: string;
  id: string;
  title: string;
  settings: readonly SettingCopy[];
}) {
  const team = useTeam(teamId);
  const update = useUpdateTeam(teamId);
  if (!team.data) return null;
  const changing = update.isPending ? (update.variables as UpdateTeamRequest) : {};
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {sectionTitle}
      </h2>
      {settings.map(({ key, title, on, off }) => {
        const visible = changing[key] ?? team.data.team[key];
        return (
          <label key={key} className={styles.setting}>
            <input
              type="checkbox"
              role="switch"
              className={switchStyles.switch}
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
