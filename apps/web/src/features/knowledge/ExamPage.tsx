import type { ExamInProgress, ExamResult } from '@sdl/contracts';
import { BAND_LABELS, POSITIONS } from '@sdl/domain';
import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { ExamBoard } from './ExamBoard';
import styles from './Knowledge.module.css';
import {
  CLOCK_ANNOUNCEMENTS,
  clockOffsetMs,
  clockTone,
  formatClock,
  remainingMs,
} from './knowledge-view';
import { useAnswer, useExam, useFinishExam, useRefreshExam } from './use-knowledge';

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'long' });
/** Pausa breve tras elegir: se ve la marca antes de pasar a la siguiente. */
const CONFIRM_MS = 220;

/** /conocimiento/examen/:examId — el examen en curso, o su resultado si ya cerró. */
export function ExamPage({ examId }: { examId: string }) {
  const exam = useExam(examId);
  if (exam.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando el examen…
        </p>
      </Screen>
    );
  }
  if (exam.isError) {
    return (
      <Screen className={styles.screen}>
        <Link to="/conocimiento" className={styles.back}>
          Volver a los exámenes
        </Link>
        <p role="alert">
          {exam.error instanceof ApiError && exam.error.status === 404
            ? 'Ese examen no existe.'
            : 'No pudimos cargar el examen. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }
  return exam.data.state === 'in_progress' ? (
    <Runner key={exam.data.examId} exam={exam.data} />
  ) : (
    <ResultView result={exam.data} />
  );
}

/** El examen en curso: una pregunta por pantalla, el reloj arriba y la revisión al final. */
function Runner({ exam }: { exam: ExamInProgress }) {
  const answer = useAnswer(exam.examId);
  const finish = useFinishExam(exam.examId);
  const refresh = useRefreshExam(exam.examId);
  const total = exam.items.length;
  const answered = exam.items.filter((i) => i.answerOptionId).length;
  const [index, setIndex] = useState(() => {
    const first = exam.items.findIndex((i) => !i.answerOptionId);
    return first === -1 ? total : first;
  });
  const reviewing = index >= total;

  // Salir a mitad no pierde nada (las respuestas ya están guardadas), pero el reloj sigue.
  const blocker = useBlocker(!finish.isSuccess);
  if (blocker.state === 'blocked') {
    return (
      <Screen className={styles.screen}>
        <h1 className={styles.title}>¿Salir del examen?</h1>
        <p className={styles.lead}>
          Tus respuestas quedan guardadas, pero el reloj sigue corriendo. Si no vuelves a tiempo, se
          entrega con lo que respondiste.
        </p>
        <div className={styles.actions}>
          <Button onClick={() => blocker.reset()}>Seguir con el examen</Button>
          <Button variant="ghost" onClick={() => blocker.proceed()}>
            Salir igual
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen className={styles.screen}>
      <Clock exam={exam} onTimeUp={() => void refresh()} />
      <div
        className={styles.strip}
        role="progressbar"
        aria-label="Preguntas respondidas"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
      >
        {exam.items.map((item, i) => (
          <span
            key={item.id}
            className={[
              item.answerOptionId ? styles.tickDone : styles.tick,
              i === index ? styles.tickHere : '',
            ].join(' ')}
          />
        ))}
      </div>

      {reviewing ? (
        <Review
          exam={exam}
          onJump={setIndex}
          onSubmit={() => finish.mutate('submit')}
          onAbandon={() => finish.mutate('abandon')}
          busy={finish.isPending}
          failed={finish.isError}
        />
      ) : (
        <Question
          key={exam.items[index]!.id}
          exam={exam}
          index={index}
          onChoose={(optionId) => {
            const item = exam.items[index]!;
            answer.mutate({ itemId: item.id, optionId });
            const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            window.setTimeout(() => setIndex((i) => i + 1), reduced ? 0 : CONFIRM_MS);
          }}
          onBack={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() => setIndex((i) => i + 1)}
        />
      )}
      {answer.isError && (
        <p role="alert" className={styles.alert}>
          No pudimos guardar tu última respuesta. Revisa la señal y vuelve a tocarla.
        </p>
      )}
    </Screen>
  );
}

function Clock({ exam, onTimeUp }: { exam: ExamInProgress; onTimeUp: () => void }) {
  // La diferencia con la hora del servidor se mide una vez, al recibir el examen.
  const [offset] = useState(() => clockOffsetMs(exam.serverNow, Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const left = remainingMs(exam.deadlineAt, offset, now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Para lectores de pantalla: el último umbral cruzado; el texto solo cambia (y se
  // anuncia) al cruzar uno, no cada segundo.
  const mark = CLOCK_ANNOUNCEMENTS.filter((m) => left <= m).at(-1);
  const announce = mark
    ? `Queda${mark === 60_000 ? ' 1 minuto' : `n ${mark / 60_000} minutos`}.`
    : '';

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onTimeUp();
    }
  }, [left, onTimeUp]);

  return (
    <div className={styles.clockBar}>
      <span className={styles.clockLabel}>{POSITIONS[exam.position].name}</span>
      <span
        className={[styles.clock, styles[clockTone(left)]].join(' ')}
        role="timer"
        aria-label={`Tiempo restante ${formatClock(left)}`}
      >
        {formatClock(left)}
      </span>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function Question({
  exam,
  index,
  onChoose,
  onBack,
  onNext,
}: {
  exam: ExamInProgress;
  index: number;
  onChoose: (optionId: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const item = exam.items[index]!;
  const heading = useRef<HTMLHeadingElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = picked ?? item.answerOptionId;
  // Con puntos en la pizarra, cada opción lleva su letra (A–D) en la cancha y en la lista.
  const options = item.options.map((o, i) => ({ ...o, letter: LETTERS[i]! }));
  const lettered = options.some((o) => o.spot);
  const choose = (optionId: string) => {
    setPicked(optionId);
    onChoose(optionId);
  };

  // Cada pregunta nueva recibe el foco: el lector de pantalla la lee.
  useEffect(() => heading.current?.focus(), []);

  return (
    <div className={styles.question}>
      <p className={styles.context}>
        {index + 1} de {exam.items.length}, {item.area.name.toLowerCase()}
      </p>
      <h1 ref={heading} tabIndex={-1} className={styles.text}>
        {item.text}
      </h1>
      {item.board && (
        <ExamBoard
          board={item.board}
          options={options}
          chosen={chosen}
          disabled={picked !== null}
          onChoose={choose}
        />
      )}
      <div className={styles.options}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.option}
            aria-pressed={chosen === option.id}
            disabled={picked !== null}
            onClick={() => choose(option.id)}
          >
            {lettered ? (
              <span className={styles.letter} aria-hidden="true">
                {option.letter}
              </span>
            ) : (
              <span className={styles.mark} aria-hidden="true" />
            )}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.navRow}>
        <Button variant="ghost" disabled={index === 0} onClick={onBack}>
          Anterior
        </Button>
        <Button variant="ghost" onClick={onNext}>
          {index === exam.items.length - 1 ? 'Revisar' : 'Saltar'}
        </Button>
      </div>
    </div>
  );
}

function Review({
  exam,
  onJump,
  onSubmit,
  onAbandon,
  busy,
  failed,
}: {
  exam: ExamInProgress;
  onJump: (index: number) => void;
  onSubmit: () => void;
  onAbandon: () => void;
  busy: boolean;
  failed: boolean;
}) {
  const [abandoning, setAbandoning] = useState(false);
  const pending = exam.items.filter((i) => !i.answerOptionId).length;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div className={styles.question}>
      <h1 ref={heading} tabIndex={-1} className={styles.title}>
        {pending === 0
          ? 'Respondiste todas'
          : `Te ${pending === 1 ? 'falta 1' : `faltan ${pending}`}`}
      </h1>
      <p className={styles.lead}>
        Toca un número para volver a esa pregunta. Puedes cambiar respuestas hasta que se acabe el
        tiempo.
      </p>
      <ol className={styles.grid}>
        {exam.items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.answerOptionId ? styles.cellDone : styles.cell}
              aria-label={`Pregunta ${i + 1}, ${item.answerOptionId ? 'respondida' : 'sin responder'}`}
              onClick={() => onJump(i)}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.actions}>
        {pending > 0 && (
          <p className={styles.note}>Las que dejes sin responder cuentan como fallo.</p>
        )}
        {failed && (
          <p role="alert" className={styles.alert}>
            No pudimos entregar el examen. Revisa tu conexión e intenta de nuevo.
          </p>
        )}
        {abandoning ? (
          <>
            <p>Si abandonas, se cuenta lo que respondiste y no puedes repetir hasta el mes.</p>
            <Button variant="secondary" busy={busy} onClick={onAbandon}>
              Sí, abandonar
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setAbandoning(false)}>
              Seguir con el examen
            </Button>
          </>
        ) : (
          <>
            <Button busy={busy} onClick={onSubmit}>
              {busy ? 'Entregando…' : 'Entregar el examen'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setAbandoning(true)}>
              Abandonar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** El resultado: puntaje, banda y desglose por área. Nunca las respuestas correctas. */
function ResultView({ result }: { result: ExamResult }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <Screen className={styles.screen}>
      <Link to="/conocimiento" className={styles.back}>
        Volver a los exámenes
      </Link>
      <header className={styles.result}>
        <p className={styles.resultPos}>{POSITIONS[result.position].name}</p>
        <h1 ref={heading} tabIndex={-1} className={styles.resultPct}>
          {Math.round(result.pct * 100)}%
        </h1>
        <p className={styles.resultBand}>{BAND_LABELS[result.band]}</p>
        <p className={styles.muted}>
          {result.score} de {result.total} correctas
          {result.endedBy === 'timeout' && '. Se acabó el tiempo: contamos lo que respondiste'}
          {result.endedBy === 'abandon' && '. Lo abandonaste: contamos lo que respondiste'}.
        </p>
      </header>

      {result.voided && (
        <div className={styles.reviewLate} role="status">
          <p>Tu entrenador anuló este examen: ya no cuenta.</p>
          <p className={styles.muted}>“{result.voided.reason}”</p>
        </div>
      )}
      {result.fromReview && !result.voided && (
        <p className={styles.note}>
          Fue una re-evaluación: este resultado reemplaza a los anteriores de la posición.
        </p>
      )}
      {result.superseded && (
        <p className={styles.note}>Lo reemplazó una re-evaluación posterior: ya no cuenta.</p>
      )}

      <section aria-labelledby="por-area" className={styles.section}>
        <h2 id="por-area" className={styles.sectionTitle}>
          Por área
        </h2>
        <ul className={styles.areas}>
          {result.byArea.map(({ area, correct, total }) => (
            <li key={area.code}>
              <span>{area.name}</span>
              <span className={styles.bar} aria-hidden="true">
                <span style={{ transform: `scaleX(${total ? correct / total : 0})` }} />
              </span>
              <span className={styles.areaScore}>
                {correct}/{total}
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          No mostramos las respuestas correctas: así el examen sigue sirviendo para todos. Fíjate en
          qué áreas te fue peor para repasarlas.
        </p>
      </section>

      <p className={styles.muted}>
        Cuenta tu mejor puntaje y no vence. Puedes volver a presentarlo desde el{' '}
        {DAY.format(new Date(result.nextAttemptAt))}.
      </p>
    </Screen>
  );
}
