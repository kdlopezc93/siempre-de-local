import type { CertPositionsResponse, PositionCode } from '@sdl/contracts';
import { BAND_LABELS, POSITIONS } from '@sdl/domain';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import styles from './Knowledge.module.css';
import { useCertPositions, useMyExams, useStartExam } from './use-knowledge';
import { percent } from '../../shared/format';
import { PageTitle } from '../../shared/ui/PageTitle';

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });
/** /conocimiento — de qué posiciones me puedo examinar, cómo voy y mis exámenes. */
export function KnowledgePage({ me }: { me: Me }) {
  const positions = useCertPositions();
  const history = useMyExams();
  // El puntaje es de la persona; el equipo solo dice desde dónde se presentó.
  const teamId = me.teams.find((t) => t.roles.includes('player'))?.team.id;

  return (
    <Screen className={styles.screen}>
      <header className={styles.header}>
        <PageTitle eyebrow="Examen de" title="conocimiento" />
        <p className={styles.lead}>
          Situaciones de partido sobre una posición, con reloj. Cuenta tu mejor puntaje y no vence.
        </p>
      </header>

      {positions.isPending ? (
        <p className="sr-only" role="status">
          Cargando…
        </p>
      ) : positions.isError ? (
        <p role="alert" className={styles.alert}>
          No pudimos cargar los exámenes. Revisa tu conexión e intenta de nuevo.
        </p>
      ) : positions.data.positions.length === 0 ? (
        <p className={styles.muted}>Todavía no hay exámenes publicados. Pronto vas a poder.</p>
      ) : (
        <Positions data={positions.data} teamId={teamId} />
      )}

      <p className={styles.note}>
        Mide lo que sabes de la posición, no cómo juegas. No es un título.
      </p>

      {history.data && history.data.length > 0 && (
        <section aria-labelledby="tus-examenes" className={styles.section}>
          <h2 id="tus-examenes" className={styles.sectionTitle}>
            Tus exámenes
          </h2>
          <ul className={styles.history}>
            {history.data.map((exam) => (
              <li key={exam.examId}>
                <Link to={`/conocimiento/examen/${exam.examId}`} className={styles.historyLink}>
                  <span>
                    {POSITIONS[exam.position].name}
                    <span className={styles.muted}>, {DAY.format(new Date(exam.submittedAt))}</span>
                  </span>
                  <span
                    className={exam.voided || exam.superseded ? styles.struck : styles.historyScore}
                  >
                    {exam.voided
                      ? 'Anulado'
                      : `${percent(exam.pct)} ${BAND_LABELS[exam.band]}${exam.superseded ? ', reemplazado' : ''}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}

function Positions({ data, teamId }: { data: CertPositionsResponse; teamId: string | undefined }) {
  const active = data.positions.find((p) => p.activeExamId)?.activeExamId ?? null;
  return (
    <>
      {active && (
        <div className={styles.resume} role="status">
          <p>Tienes un examen a medias y el reloj sigue corriendo.</p>
          <ButtonLink to={`/conocimiento/examen/${active}`} variant="accent">
            Seguir con tu examen
          </ButtonLink>
        </div>
      )}
      <ul className={styles.positions}>
        {data.positions.map((p) => (
          <li key={p.position}>
            <PositionCard info={p} teamId={teamId} blocked={active !== null} />
          </li>
        ))}
      </ul>
    </>
  );
}

function PositionCard({
  info,
  teamId,
  blocked,
}: {
  info: CertPositionsResponse['positions'][number];
  teamId: string | undefined;
  blocked: boolean;
}) {
  const start = useStartExam();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const minutes = Math.round(info.bank.timeLimitSeconds / 60);
  const name = POSITIONS[info.position as PositionCode].name;

  function begin() {
    start.mutate(
      { position: info.position, ...(teamId ? { teamId } : {}) },
      {
        onSuccess: (exam) => void navigate(`/conocimiento/examen/${exam.examId}`),
        onError: (error) => {
          // Si ya había uno abierto (otra pestaña), se retoma ese.
          const examId = error instanceof ApiError ? activeFrom(error) : null;
          if (examId) void navigate(`/conocimiento/examen/${examId}`);
        },
      },
    );
  }

  return (
    <article className={styles.card} aria-labelledby={`pos-${info.position}`}>
      <h2 id={`pos-${info.position}`} className={styles.cardTitle}>
        {name}
      </h2>
      <p className={styles.muted}>
        {info.bank.itemsPerExam} preguntas en {minutes} minutos. Áreas:{' '}
        {info.bank.areas.map((a) => a.name.toLowerCase()).join(', ')}.
      </p>
      {info.best && (
        <p className={styles.best}>
          Tu mejor puntaje: <strong>{percent(info.best.pct)}</strong>, {BAND_LABELS[info.best.band]}
          {info.best.underReview && ' (a revisar)'}
        </p>
      )}

      {info.review && (
        <div className={info.review.status === 'expired' ? styles.reviewLate : styles.review}>
          <p>
            {info.review.status === 'expired'
              ? `Tu entrenador te pidió volver a presentarlo y el plazo venció el ${DAY.format(new Date(info.review.dueAt))}. Todavía puedes hacerlo.`
              : `Tu entrenador te pidió volver a presentarlo antes del ${DAY.format(new Date(info.review.dueAt))}. No hace falta esperar el mes.`}
          </p>
          <p className={styles.muted}>“{info.review.reason}”</p>
          <p className={styles.muted}>Este resultado reemplaza al anterior, aunque sea más bajo.</p>
        </div>
      )}

      {info.nextAttemptAt ? (
        <p className={styles.muted}>
          Puedes volver a presentarlo desde el {DAY.format(new Date(info.nextAttemptAt))}.
        </p>
      ) : confirming ? (
        <div className={styles.confirm}>
          <p>El reloj de {minutes} minutos arranca apenas empieces. Busca un rato tranquilo.</p>
          <Button busy={start.isPending} onClick={begin}>
            {start.isPending ? 'Preparando…' : 'Empezar ahora'}
          </Button>
          <Button variant="ghost" disabled={start.isPending} onClick={() => setConfirming(false)}>
            Mejor después
          </Button>
        </div>
      ) : (
        <Button variant="secondary" disabled={blocked} onClick={() => setConfirming(true)}>
          {info.review
            ? 'Presentar la re-evaluación'
            : info.best
              ? 'Presentarlo de nuevo'
              : 'Presentar el examen'}
        </Button>
      )}
      {start.isError && !activeFrom(start.error) && (
        <p role="alert" className={styles.alert}>
          {start.error instanceof ApiError && start.error.status < 500
            ? start.error.message
            : 'No pudimos empezar el examen. Revisa tu conexión e intenta de nuevo.'}
        </p>
      )}
    </article>
  );
}

function activeFrom(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== 'EXAM_IN_PROGRESS') return null;
  const examId = error.details?.['examId'];
  return typeof examId === 'string' ? examId : null;
}
