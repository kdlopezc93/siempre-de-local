import type { ExamResult, KnowledgeReview, PlayerKnowledge, PositionCode } from '@sdl/contracts';
import { BAND_LABELS, POSITIONS } from '@sdl/domain';
import { useId, useState, type FormEvent } from 'react';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import styles from './KnowledgeSection.module.css';
import { useCancelReview, useRequestReview, useVoidExam } from './use-knowledge-staff';

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });
const percent = (pct: number) => `${Math.round(pct * 100)}%`;
const day = (iso: string) => DAY.format(new Date(iso));

/**
 * El examen de conocimiento de un jugador, para el cuerpo técnico (02 §6.6–6.7): mejor
 * puntaje por posición, re-evaluaciones y sus exámenes. Anular y pedir re-evaluación solo
 * para coach y admin del club (`manages`).
 */
export function KnowledgeSection({
  teamId,
  playerId,
  knowledge,
  manages,
}: {
  teamId: string;
  playerId: string;
  knowledge: PlayerKnowledge;
  manages: boolean;
}) {
  return (
    <section aria-labelledby="conocimiento" className={styles.section}>
      <h2 id="conocimiento" className={styles.sectionTitle}>
        Conocimiento
      </h2>
      {knowledge.positions.length === 0 ? (
        <p className={styles.muted}>Todavía no hay exámenes publicados.</p>
      ) : (
        <ul className={styles.positions}>
          {knowledge.positions.map((p) => (
            <li key={p.position}>
              <PositionRow
                teamId={teamId}
                playerId={playerId}
                position={p.position}
                best={p.best}
                review={p.review}
                manages={manages}
              />
            </li>
          ))}
        </ul>
      )}

      {knowledge.exams.length > 0 && (
        <>
          <h3 className={styles.subTitle}>Sus exámenes</h3>
          <ul className={styles.exams}>
            {knowledge.exams.map((exam) => (
              <li key={exam.examId}>
                <ExamRow teamId={teamId} exam={exam} manages={manages} />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={styles.note}>
        Mide lo que sabe de la posición, no cómo juega. Una re-evaluación reemplaza al puntaje
        anterior, aunque salga más bajo.
      </p>
    </section>
  );
}

function PositionRow({
  teamId,
  playerId,
  position,
  best,
  review,
  manages,
}: {
  teamId: string;
  playerId: string;
  position: PositionCode;
  best: PlayerKnowledge['positions'][number]['best'];
  review: KnowledgeReview | null;
  manages: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = useCancelReview(teamId);
  return (
    <div className={styles.position}>
      <div className={styles.positionHead}>
        <span className={styles.positionName}>{POSITIONS[position].name}</span>
        <span className={best ? styles.score : styles.muted}>
          {best ? `${percent(best.pct)} ${BAND_LABELS[best.band]}` : 'Sin examen'}
        </span>
      </div>
      {review && (
        <div className={review.status === 'expired' ? styles.reviewLate : styles.review}>
          <p>
            {review.status === 'expired'
              ? `Re-evaluación vencida el ${day(review.dueAt)}: mientras no la presente, este puntaje no cuenta en el planificador.`
              : `Re-evaluación pedida, hasta el ${day(review.dueAt)}.`}
          </p>
          <p className={styles.muted}>“{review.reason}”</p>
          {manages &&
            (confirmCancel ? (
              <div className={styles.formActions}>
                <Button
                  variant="secondary"
                  busy={cancel.isPending}
                  onClick={() => cancel.mutate(review.id)}
                >
                  Sí, cancelarla
                </Button>
                <Button
                  variant="ghost"
                  disabled={cancel.isPending}
                  onClick={() => setConfirmCancel(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                Cancelar la re-evaluación
              </Button>
            ))}
        </div>
      )}
      {manages && !review && !asking && (
        <Button variant="ghost" onClick={() => setAsking(true)}>
          Pedir re-evaluación
        </Button>
      )}
      {asking && (
        <ReviewForm
          teamId={teamId}
          playerId={playerId}
          position={position}
          onDone={() => setAsking(false)}
        />
      )}
    </div>
  );
}

function ReviewForm({
  teamId,
  playerId,
  position,
  onDone,
}: {
  teamId: string;
  playerId: string;
  position: PositionCode;
  onDone: () => void;
}) {
  const request = useRequestReview(teamId, playerId);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('14');
  const [invalid, setInvalid] = useState<string | null>(null);
  const reasonId = useId();
  const daysId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dueInDays = Number(days);
    if (reason.trim().length < 5) return setInvalid('Escribe el motivo: lo va a leer el jugador.');
    if (!Number.isInteger(dueInDays) || dueInDays < 1 || dueInDays > 60) {
      return setInvalid('El plazo va de 1 a 60 días.');
    }
    setInvalid(null);
    request.mutate({ position, reason: reason.trim(), dueInDays }, { onSuccess: onDone });
  }

  const error =
    invalid ??
    (request.error instanceof ApiError && request.error.status < 500
      ? request.error.message
      : request.isError
        ? 'No pudimos pedir la re-evaluación. Revisa tu conexión e intenta de nuevo.'
        : null);

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={reasonId} className={styles.label}>
        Motivo (lo ve el jugador)
      </label>
      <textarea
        id={reasonId}
        name="reason"
        autoComplete="off"
        className={styles.textarea}
        rows={3}
        maxLength={500}
        value={reason}
        placeholder="Ej.: en la cancha no está aplicando lo que sabe de la línea…"
        onChange={(event) => setReason(event.target.value)}
      />
      <label htmlFor={daysId} className={styles.label}>
        Plazo para presentarla (días)
      </label>
      <input
        id={daysId}
        name="days"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={styles.days}
        value={days}
        onChange={(event) => setDays(event.target.value.replace(/\D/g, ''))}
      />
      <p className={styles.muted}>
        Puede presentarla sin esperar el mes. Su resultado reemplaza al anterior aunque sea más
        bajo.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="submit" busy={request.isPending}>
          Pedir re-evaluación
        </Button>
        <Button variant="ghost" disabled={request.isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ExamRow({
  teamId,
  exam,
  manages,
}: {
  teamId: string;
  exam: ExamResult;
  manages: boolean;
}) {
  const [voiding, setVoiding] = useState(false);
  return (
    <div className={styles.exam}>
      <div className={styles.positionHead}>
        <span>
          {POSITIONS[exam.position].name}
          <span className={styles.muted}>, {day(exam.submittedAt)}</span>
        </span>
        <span className={exam.voided || exam.superseded ? styles.struck : styles.score}>
          {percent(exam.pct)} {BAND_LABELS[exam.band]}
        </span>
      </div>
      <p className={styles.tags}>
        {exam.fromReview && <span className={styles.tag}>Re-evaluación</span>}
        {exam.superseded && <span className={styles.tag}>Reemplazado</span>}
        {exam.endedBy === 'timeout' && <span className={styles.tag}>Se le acabó el tiempo</span>}
        {exam.endedBy === 'abandon' && <span className={styles.tag}>Abandonado</span>}
      </p>
      {exam.voided ? (
        <p className={styles.muted}>Anulado: “{exam.voided.reason}”</p>
      ) : (
        manages &&
        !voiding && (
          <Button variant="ghost" onClick={() => setVoiding(true)}>
            Anular
          </Button>
        )
      )}
      {voiding && !exam.voided && (
        <VoidForm teamId={teamId} examId={exam.examId} onDone={() => setVoiding(false)} />
      )}
    </div>
  );
}

function VoidForm({
  teamId,
  examId,
  onDone,
}: {
  teamId: string;
  examId: string;
  onDone: () => void;
}) {
  const voidExam = useVoidExam(teamId);
  const [reason, setReason] = useState('');
  const [reset, setReset] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const reasonId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 5) return setInvalid(true);
    setInvalid(false);
    voidExam.mutate({ examId, reason: reason.trim(), resetInterval: reset }, { onSuccess: onDone });
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={reasonId} className={styles.label}>
        ¿Por qué lo anulas? (lo ve el jugador)
      </label>
      <textarea
        id={reasonId}
        name="reason"
        autoComplete="off"
        className={styles.textarea}
        rows={2}
        maxLength={500}
        value={reason}
        placeholder="Ej.: lo hizo otra persona…"
        onChange={(event) => setReason(event.target.value)}
      />
      <label className={styles.check}>
        <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} />
        <span>Que pueda repetirlo sin esperar el mes</span>
      </label>
      <p className={styles.muted}>Deja de contar y pasa a valer su mejor examen restante.</p>
      {(invalid || voidExam.isError) && (
        <p role="alert" className={styles.error}>
          {invalid
            ? 'Escribe el motivo: lo va a leer el jugador.'
            : 'No pudimos anular el examen. Revisa tu conexión e intenta de nuevo.'}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="submit" variant="secondary" busy={voidExam.isPending}>
          Anular examen
        </Button>
        <Button variant="ghost" disabled={voidExam.isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
