import { POSITIONS } from '@sdl/domain';
import { Link } from 'react-router';

import { Screen } from '../../shared/ui/Screen';
import { useSquad } from '../squad/use-squad';
import { useTeam } from '../team-admin/use-invitations';
import { RATED_ON, rankedAverages } from './card-view';
import styles from './CardPages.module.css';
import { PlayerCard } from './PlayerCard';
import { useRatingHistory } from './use-card';

/** /equipos/:teamId/plantilla/:playerId/tarjeta — la tarjeta y sus fotos anteriores. */
export function StaffCardPage({ teamId, playerId }: { teamId: string; playerId: string }) {
  const team = useTeam(teamId);
  const squad = useSquad(teamId);
  const history = useRatingHistory(teamId, playerId);

  const back = (
    <Link to={`/equipos/${teamId}/plantilla`} className={styles.back}>
      Volver a la plantilla
    </Link>
  );
  if (team.isPending || squad.isPending || history.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando la tarjeta…
        </p>
      </Screen>
    );
  }
  const player = squad.data?.players.find((p) => p.userId === playerId);
  if (!team.data || !player || history.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert">
          {player || squad.isError
            ? 'No pudimos cargar la tarjeta. Revisa tu conexión e intenta de nuevo.'
            : 'Ese jugador no está en la plantilla.'}
        </p>
      </Screen>
    );
  }

  const format = team.data.team.format;
  const rates = team.data.myRoles.some((role) => role === 'coach' || role === 'assistant');
  const [latest, ...older] = history.data;

  return (
    <Screen className={styles.screen}>
      {back}
      <header>
        <h1 className={styles.subtitle}>{player.displayName}</h1>
        <p className={styles.muted}>Tarjeta 0–99</p>
      </header>

      {latest ? (
        <PlayerCard card={latest} format={format} />
      ) : (
        <p className={styles.muted}>Todavía nadie del cuerpo técnico lo puntuó.</p>
      )}
      {latest?.ratedBy && <p className={styles.muted}>La puntuó {latest.ratedBy.name}.</p>}
      {latest?.notes && <p className={styles.notes}>“{latest.notes}”</p>}
      {rates && (
        <Link
          to={`/equipos/${teamId}/plantilla/${playerId}/tarjeta/puntuar`}
          className={styles.primaryLink}
        >
          {latest ? 'Puntuar de nuevo' : 'Puntuar'}
        </Link>
      )}

      {older.length > 0 && (
        <section aria-labelledby="anteriores" className={styles.section}>
          <h2 id="anteriores" className={styles.sectionTitle}>
            Fotos anteriores
          </h2>
          <ul className={styles.history}>
            {older.map((rating) => {
              const best = rankedAverages(rating.positionAverages, format)[0];
              return (
                <li key={rating.id}>
                  <div className={styles.historyHead}>
                    <span>
                      {RATED_ON.format(new Date(rating.ratedAt))}
                      {rating.ratedBy && `, por ${rating.ratedBy.name}`}
                    </span>
                    {best && (
                      <span className={styles.historyBest}>
                        {best.value} {POSITIONS[best.pos].name}
                      </span>
                    )}
                  </div>
                  {rating.notes && <p className={styles.notes}>“{rating.notes}”</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Screen>
  );
}
