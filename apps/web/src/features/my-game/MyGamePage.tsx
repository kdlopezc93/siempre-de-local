import type { CertPositionsResponse, MatchFormat, PositionCode } from '@sdl/contracts';
import { BAND_LABELS, positionName, POSITIONS } from '@sdl/domain';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import { Link } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Row } from '../../shared/ui/Row';
import { Screen } from '../../shared/ui/Screen';
import { LeadTask } from '../../shared/ui/TaskCard';
import { lineOfPosition, Token } from '../../shared/ui/Token';
import { PlayerCard } from '../card/PlayerCard';
import { useMyCard } from '../card/use-card';
import { useHistory } from '../history/use-history';
import { useCertPositions } from '../knowledge/use-knowledge';
import { ratingLabel } from '../matches/after-match';
import { matchDay } from '../matches/match-view';
import { useMatches } from '../matches/use-matches';
import { pesos } from '../charges/charge-view';
import { useMyCharges } from '../charges/use-charges';
import styles from './MyGamePage.module.css';
import { percent } from '../../shared/format';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { PageTitle } from '../../shared/ui/PageTitle';
import { SectionHead } from '../../shared/ui/SectionHead';
import { StatGrid, StatTile } from '../../shared/ui/StatTile';

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });
/**
 * /equipos/:teamId/mi-juego — lo tuyo como jugador en este equipo (07 §4.3): tu tarjeta, tu
 * posición según el test, tu conocimiento y tu perfil. Una vez hecho, el test queda como
 * resultado; repetirlo es secundario.
 */
export function MyGamePage({ me, teamId }: { me: Me; teamId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId);
  const charges = useMyCharges(teamId);
  const owed = charges.data?.owed ?? 0;
  const unpaid = charges.data?.items.filter((i) => i.status !== 'paid').length ?? 0;
  return (
    <Screen className={styles.screen}>
      <PageTitle
        eyebrow={me.profile.displayName}
        title="Mi juego"
        subtitle={
          membership?.jerseyNumber != null
            ? `Dorsal ${membership.jerseyNumber}`
            : 'Sin dorsal todavía: te lo pone el entrenador.'
        }
        actions={
          <Avatar
            name={me.profile.displayName}
            label={membership?.jerseyNumber != null ? String(membership.jerseyNumber) : null}
            size={56}
          />
        }
      />
      <SeasonSection meId={me.user.id} teamId={teamId} />
      {membership && <CardSection teamId={teamId} format={membership.team.format} />}
      <PositionSection me={me} teamId={teamId} />
      <MatchesSection meId={me.user.id} teamId={teamId} />
      <KnowledgeSection me={me} teamId={teamId} />
      <ul className={styles.list}>
        {/* Los cobros del equipo (`06` Cobros): solo lo tuyo. */}
        {(charges.data?.items.length ?? 0) > 0 && (
          <li>
            <Row
              to={`/equipos/${teamId}/mis-cuentas`}
              leading={
                <span className={styles.icon} data-tint="2" aria-hidden="true">
                  <Wallet size={22} />
                </span>
              }
              title="Tus cuentas"
              meta={owed > 0 ? `Debes ${pesos(owed)}` : 'Estás al día'}
              trailing={
                unpaid > 0 ? (
                  <Badge tone="danger" size="sm">
                    {unpaid} por pagar
                  </Badge>
                ) : undefined
              }
            />
          </li>
        )}
        <li>
          <Row
            to="/perfil"
            leading={
              <span className={styles.icon} data-tint="4" aria-hidden="true">
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

/** Tu temporada de un vistazo: los partidos que jugaste, las veces que fuiste figura y tus tests. */
function SeasonSection({ meId, teamId }: { meId: string; teamId: string }) {
  const matches = useMatches(teamId);
  const history = useHistory(meId);
  const items = matches.data?.items ?? [];
  const played = items.filter(
    (m) => m.result && (m.myRating !== null || m.result.figure?.id === meId),
  ).length;
  const figure = items.filter((m) => m.result?.figure?.id === meId).length;
  const tests = history.entries.filter((e) =>
    e.kind === 'official' ? e.result.teamId === teamId : e.teamId === teamId,
  ).length;
  return (
    <section aria-label="Tu temporada">
      <StatGrid>
        <StatTile label="Partidos" value={played} />
        <StatTile label="Figura" value={figure} tone={figure > 0 ? 'volt' : 'white'} />
        <StatTile label="Tests" value={tests} />
      </StatGrid>
    </section>
  );
}

function CardSection({ teamId, format }: { teamId: string; format: MatchFormat }) {
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

/**
 * Tus últimos partidos (D18): el marcador y cómo jugaste, si tu equipo lo muestra; la figura
 * siempre. Sin partidos con nada que mostrar, no aparece.
 */
function MatchesSection({ meId, teamId }: { meId: string; teamId: string }) {
  const matches = useMatches(teamId);
  const mine = (matches.data?.items ?? [])
    .filter((m) => m.result && (m.myRating !== null || m.result.figure?.id === meId))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 5);
  if (mine.length === 0) return null;
  return (
    <section aria-labelledby="partidos" className={styles.section}>
      <SectionHead id="partidos" title="Tus últimos partidos" />
      <ul className={styles.matches}>
        {mine.map((m) => (
          <li key={m.id}>
            <Link to={`/equipos/${teamId}/partidos/${m.id}`} className={styles.matchRow}>
              <span className={styles.matchWho}>
                {m.opponent}
                <span className={styles.matchMeta}>
                  {matchDay(m.startsAt)}, {m.result!.goalsFor} a {m.result!.goalsAgainst}
                </span>
              </span>
              {m.result!.figure?.id === meId ? (
                <Badge tone="accent">Figura del partido</Badge>
              ) : m.myRating !== null ? (
                <Badge tone="brand">{ratingLabel(m.myRating)}</Badge>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.muted}>Es la mirada de tu cuerpo técnico, partido a partido.</p>
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
      <SectionHead id="posicion" title="Tu posición" />
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
                    <span className={styles.podiumName}>
                      {positionName(pos, latest.result.format)}
                    </span>
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

/**
 * Tu conocimiento en tus posiciones (las que marcaste y las del podio de tu último test), más lo
 * que pide atención (un examen a medias, una re-evaluación). Las demás, en "Ver todo".
 */
function KnowledgeSection({ me, teamId }: { me: Me; teamId: string }) {
  const positions = useCertPositions();
  const history = useHistory(me.user.id);
  if (positions.isPending) return null;
  if (positions.isError || positions.data.positions.length === 0) return null;
  const now = new Date();
  const latest = history.entries.find((e) => e.kind === 'official' && e.result.teamId === teamId);
  const mine = new Set<PositionCode>([
    ...me.profile.preferredPositions,
    ...(latest?.kind === 'official' ? latest.result.podium : []),
  ]);
  const all = positions.data.positions;
  const shown = mine.size
    ? all.filter((p) => mine.has(p.position) || p.activeExamId || p.review)
    : all;
  return (
    <section aria-labelledby="conocimiento" className={styles.section}>
      <SectionHead
        id="conocimiento"
        title="Conocimiento"
        link={{ to: '/conocimiento', label: 'Ver todo' }}
      />
      <ul className={styles.list}>
        {shown.map((p) => (
          <li key={p.position}>
            <Row
              to="/conocimiento"
              leading={
                <Avatar name={p.position} label={p.position} line={lineOfPosition(p.position)} />
              }
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
  if (p.activeExamId) return <Badge tone="warning">A medias</Badge>;
  if (p.review || !p.nextAttemptAt || new Date(p.nextAttemptAt) <= now) {
    return <Badge tone="brand">{p.best ? 'Repetir' : 'Presentar'}</Badge>;
  }
  return <span className={styles.muted}>Desde el {DAY.format(new Date(p.nextAttemptAt))}</span>;
}
