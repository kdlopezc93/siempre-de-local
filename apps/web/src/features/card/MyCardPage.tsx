import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Screen } from '../../shared/ui/Screen';
import styles from './CardPages.module.css';
import { PlayerCard } from './PlayerCard';
import { useMyCard } from './use-card';

/** /equipos/:teamId/tarjeta — la tarjeta del propio jugador, si su equipo la muestra (D8). */
export function MyCardPage({ me, teamId }: { me: Me; teamId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId && t.roles.includes('player'));
  const card = useMyCard(teamId);

  return (
    <Screen className={styles.screen}>
      <header>
        <h1 className={styles.title}>Tu tarjeta</h1>
        {membership && <p className={styles.muted}>{membership.team.name}</p>}
      </header>
      {card.isPending ? (
        <p className="sr-only" role="status">
          Cargando tu tarjeta…
        </p>
      ) : card.isError ? (
        <p role="alert" className={styles.muted}>
          {card.error instanceof ApiError && card.error.code === 'CARD_HIDDEN'
            ? 'En tu equipo la tarjeta la ve solo el cuerpo técnico.'
            : card.error instanceof ApiError && card.error.status === 404
              ? 'Solo los jugadores del equipo tienen tarjeta en él.'
              : 'No pudimos cargar tu tarjeta. Revisa tu conexión e intenta de nuevo.'}
        </p>
      ) : !card.data.card || !membership ? (
        <p className={styles.muted}>
          Todavía no te puntuaron. Cuando tu cuerpo técnico lo haga, aparece aquí.
        </p>
      ) : (
        <>
          <PlayerCard card={card.data.card} format={membership.team.format} />
          <p className={styles.muted}>
            Es la mirada de tu cuerpo técnico, no un veredicto. El 0–99 se mide contra el nivel de
            tu categoría, no contra el fútbol profesional.
          </p>
        </>
      )}
    </Screen>
  );
}
