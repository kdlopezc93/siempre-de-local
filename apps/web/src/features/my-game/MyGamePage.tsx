import type { CertPositionsResponse } from '@sdl/contracts';
import { BAND_LABELS, POSITIONS } from '@sdl/domain';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { LeadTask } from '../../shared/ui/TaskCard';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { lineOfPosition, Token } from '../../shared/ui/Token';
import { PlayerCard } from '../card/PlayerCard';
import { useMyCard } from '../card/use-card';
import { useHistory } from '../history/use-history';
import { useCertPositions } from '../knowledge/use-knowledge';
import styles from './MyGamePage.module.css';

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });
const percent = (pct: number) => `${Math.round(pct * 100)}%`;

/**
 * /equipos/:teamId/mi-juego — lo tuyo como jugador en este equipo (07 §4.3): tu tarjeta, tu
 * posición según el test, tu conocimiento y tu perfil. Una vez hecho, el test queda como
 * resultado; repetirlo es secundario.
 */
export function MyGamePage({ me, teamId }: { me: Me; teamId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId);
  return (
    <Screen className={styles.screen}>
      <header className={styles.hero}>
        <Token
          text={
            membership?.jerseyNumber != null
              ? String(membership.jerseyNumber)
              : initialsOf(me.profile.displayName)
          }
          size="lg"
          tone="amber"
          {...(membership?.jerseyNumber != null
            ? { label: `Dorsal ${membership.jerseyNumber}` }
            : {})}
        />
        <div>
          <h1 className={styles.title}>Mi juego</h1>
          <p className={styles.muted}>
            {membership?.jerseyNumber != null
              ? `Dorsal ${membership.jerseyNumber}`
              : 'Sin dorsal todavía: te lo pone el entrenador.'}
          </p>
        </div>
      </header>
      {membership && <CardSection teamId={teamId} format={membership.team.format} />}
      <PositionSection me={me} teamId={teamId} />
      <KnowledgeSection />
      <ul className={styles.list}>
        <li>
          <Row
            to="/perfil"
            leading={
              <span className={styles.icon} aria-hidden="true">
                <NotePencil size={22} />
              </span>
            }
            title="Editar mi perfil"
            meta="Cómo te dicen, tu pie, tus posiciones"
          />
        </li>
      </ul>
    </Screen>
  );
}

function CardSection({ teamId, format }: { teamId: string; format: 'F11' | 'F8' }) {
  const card = useMyCard(teamId);
  if (card.isPending) {
    return (
      <p className="sr-only" role="status">
        Cargando tu tarjeta…
      </p>
    );
  }
  if (card.isError || !card.data.card) {
    const hidden = card.error instanceof ApiError && card.error.code === 'CARD_HIDDEN';
    return (
      <p className={styles.note} role={card.isError && !hidden ? 'alert' : undefined}>
        {hidden
          ? 'En tu equipo la tarjeta la ve solo el cuerpo técnico.'
          : card.isError
            ? 'No pudimos cargar tu tarjeta. Revisa tu conexión.'
            : 'Todavía no te puntuaron. Cuando tu cuerpo técnico lo haga, tu tarjeta aparece aquí.'}
      </p>
    );
  }
  return (
    <section aria-label="Tu tarjeta" className={styles.section}>
      <PlayerCard card={card.data.card} format={format} />
      <p className={styles.muted}>Es la mirada de tu cuerpo técnico, no un veredicto.</p>
    </section>
  );
}

function PositionSection({ me, teamId }: { me: Me; teamId: string }) {
  const history = useHistory(me.user.id);
  const here = history.entries.filter((e) =>
    e.kind === 'official' ? e.result.teamId === teamId : e.teamId === teamId,
  );
  const latest = here[0];

  return (
    <section aria-labelledby="posicion" className={styles.section}>
      <h2 id="posicion" className={styles.sectionTitle}>
        Tu posición
      </h2>
      {history.isPending && history.entries.length === 0 ? (
        <p className="sr-only" role="status">
          Cargando tu test…
        </p>
      ) : !latest ? (
        history.isError ? (
          <p className={styles.note}>No pudimos cargar tu test. Ábrelo una vez con conexión.</p>
        ) : (
          <LeadTask
            to={`/equipos/${teamId}/test`}
            title="Haz tu test de posición"
            detail="20 preguntas sobre situaciones de juego"
          />
        )
      ) : latest.kind === 'pending' ? (
        <p className={styles.note}>Tu test se envía cuando tengas señal y abras la app.</p>
      ) : (
        <>
          <Link to={`/resultados/${latest.result.attemptId}`} className={styles.podium}>
            <ol aria-label="Tus 3 posiciones">
              {latest.result.podium.map((pos, i) => {
                const pct = latest.result.ranking.find((r) => r.pos === pos)?.pct;
                return (
                  <li key={pos}>
                    <Token text={String(i + 1)} line={lineOfPosition(pos)} size="sm" />
                    <span className={styles.podiumName}>{POSITIONS[pos].name}</span>
                    {pct !== undefined && <span className={styles.muted}>{percent(pct)}</span>}
                  </li>
                );
              })}
            </ol>
            <span className={styles.podiumMeta}>
              Test del {DAY.format(new Date(latest.result.submittedAt))}. Ver el resultado
            </span>
          </Link>
          <div className={styles.quietRow}>
            <Link to={`/equipos/${teamId}/test`} className={styles.quiet}>
              Repetir el test
            </Link>
            {here.length > 1 && (
              <Link to="/historial" className={styles.quiet}>
                Tus {here.length} tests
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function KnowledgeSection() {
  const positions = useCertPositions();
  if (positions.isPending) return null;
  if (positions.isError || positions.data.positions.length === 0) return null;
  const now = new Date();
  return (
    <section aria-labelledby="conocimiento" className={styles.section}>
      <h2 id="conocimiento" className={styles.sectionTitle}>
        Conocimiento
      </h2>
      <ul className={styles.list}>
        {positions.data.positions.map((p) => (
          <li key={p.position}>
            <Row
              to="/conocimiento"
              leading={<Token text={p.position} line={lineOfPosition(p.position)} />}
              title={POSITIONS[p.position].name}
              meta={knowledgeMeta(p)}
              trailing={<Availability p={p} now={now} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

type CertPosition = CertPositionsResponse['positions'][number];

function knowledgeMeta(p: CertPosition): string {
  const best = p.best
    ? `${percent(p.best.pct)}, ${BAND_LABELS[p.best.band].toLowerCase()}`
    : 'Sin presentar';
  if (!p.review) return best;
  return p.review.status === 'expired'
    ? `${best}. Re-evaluación vencida`
    : `${best}. Re-evaluación hasta el ${DAY.format(new Date(p.review.dueAt))}`;
}

function Availability({ p, now }: { p: CertPosition; now: Date }) {
  if (p.activeExamId) return <span className={styles.ready}>A medias</span>;
  if (p.review || !p.nextAttemptAt || new Date(p.nextAttemptAt) <= now) {
    return <span className={styles.ready}>{p.best ? 'Repetir' : 'Presentar'}</span>;
  }
  return <span className={styles.muted}>Desde el {DAY.format(new Date(p.nextAttemptAt))}</span>;
}
