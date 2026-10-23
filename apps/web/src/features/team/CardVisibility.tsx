import { useUpdateTeam } from '../card/use-card';
import { useTeam } from '../team-admin/use-invitations';
import styles from './TeamPage.module.css';

/** D8: si los jugadores ven su tarjeta en este equipo (coach y admin del club). */
export function CardVisibility({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const update = useUpdateTeam(teamId);
  if (!team.data) return null;
  const visible = team.data.team.ratingsVisibleToPlayers;
  return (
    <section aria-labelledby="ajustes" className={styles.section}>
      <h2 id="ajustes" className={styles.sectionTitle}>
        Ajustes
      </h2>
      <label className={styles.setting}>
        <input
          type="checkbox"
          role="switch"
          checked={update.isPending ? !visible : visible}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ ratingsVisibleToPlayers: event.target.checked })}
        />
        <span>
          Los jugadores ven su tarjeta
          <span className={styles.settingHint}>
            {visible ? 'Cada uno ve la suya, sin tus notas.' : 'Solo el cuerpo técnico la ve.'}
          </span>
        </span>
      </label>
      {update.isError && (
        <p role="alert" className={styles.error}>
          No pudimos cambiar el ajuste. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </section>
  );
}
