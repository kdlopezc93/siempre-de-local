import type { MatchFormat } from '@sdl/contracts';
import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import { ResultView } from '../result/ResultView';
import { CONTEXT, FORMAT } from './labels';
import { isDone, type ShownItem } from './quiz-engine';
import styles from './QuizPage.module.css';
import { useQuiz, type SubmitStatus } from './use-quiz';

/** /equipos/:teamId/test — el test de orientación del jugador. */
export function QuizPage({ me, teamId }: { me: Me; teamId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId && t.roles.includes('player'));
  if (!membership) {
    return (
      <Screen className={styles.screen}>
        <h1 className={styles.title}>Test de posición</h1>
        <p className={styles.lead}>Solo los jugadores del equipo hacen el test en él.</p>
        <Link to="/" className={styles.back}>
          Volver al inicio
        </Link>
      </Screen>
    );
  }
  return <Quiz userId={me.user.id} team={membership.team} />;
}

function Quiz({ userId, team }: { userId: string; team: Me['teams'][number]['team'] }) {
  const quiz = useQuiz(userId, team);
  const inProgress = quiz.state !== null && !isDone(quiz.state);
  const blocker = useBlocker(inProgress);

  // Cerrar o recargar la pestaña a mitad del test también avisa.
  useEffect(() => {
    if (!inProgress) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [inProgress]);

  if (blocker.state === 'blocked') {
    return (
      <Screen className={styles.screen}>
        <h1 className={styles.title}>¿Dejar el test?</h1>
        <p className={styles.lead}>Si sales ahora pierdes lo que llevas respondido.</p>
        <div className={styles.actions}>
          <Button onClick={() => blocker.reset()}>Seguir con el test</Button>
          <Button variant="ghost" onClick={() => blocker.proceed()}>
            Salir sin terminar
          </Button>
        </div>
      </Screen>
    );
  }

  if (!quiz.state) return <Intro team={team} quiz={quiz} />;
  if (isDone(quiz.state)) {
    return <Submitted status={quiz.submit!} format={team.format} onRestart={quiz.restart} />;
  }

  const { index, items } = quiz.state;
  return (
    <Question
      key={items[index]!.id}
      index={index}
      total={items.length}
      item={items[index]!}
      onChoose={(optionId) => void quiz.choose(optionId)}
    />
  );
}

function Intro({
  team,
  quiz,
}: {
  team: Me['teams'][number]['team'];
  quiz: ReturnType<typeof useQuiz>;
}) {
  const { questionnaire } = quiz;
  return (
    <Screen className={styles.screen}>
      <Link to="/" className={styles.back}>
        Volver al inicio
      </Link>
      {/* Lo fuerte de la pantalla: el bloque cobalto con la pregunta y las cifras del test. */}
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Test de posición</p>
        <h1 className={styles.heroTitle}>¿Dónde deberías jugar?</h1>
        <p className={styles.heroLead}>
          20 preguntas sobre situaciones de juego y tus cualidades. Al final ves las 3 posiciones
          donde mejor encajas.
        </p>
        <p className={styles.heroMeta} translate="no">
          {team.name}, {FORMAT[team.format]}
        </p>
      </section>
      <div className={styles.actions}>
        {questionnaire.isError && (
          <p role="alert" className={styles.alert}>
            No pudimos cargar las preguntas. Ábrelo una vez con conexión y después funciona sin
            señal.
          </p>
        )}
        <Button busy={questionnaire.isPending} disabled={!questionnaire.data} onClick={quiz.start}>
          {questionnaire.isPending ? 'Cargando preguntas…' : 'Empezar'}
        </Button>
        <p className={styles.note}>
          Si te quedas sin señal, sigue respondiendo: lo enviamos cuando vuelva. Es una orientación,
          no un veredicto.
        </p>
        <Link to="/bases" className={styles.back}>
          En qué se basa el test
        </Link>
      </div>
    </Screen>
  );
}

const QUESTION_LABEL = 'Test de posición';
/** Pausa breve tras tocar una opción: se ve la elección antes de pasar a la siguiente. */
const CONFIRM_MS = 220;

function Question({
  index,
  total,
  item,
  onChoose,
}: {
  index: number;
  total: number;
  item: ShownItem;
  onChoose: (optionId: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Cada pregunta nueva recibe el foco: el lector de pantalla la lee y el teclado sigue ahí.
  useEffect(() => headingRef.current?.focus(), []);

  function choose(optionId: string) {
    if (chosen) return;
    setChosen(optionId);
    // Con movimiento reducido no hay pausa: se pasa directo a la siguiente.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => onChoose(optionId), reduced ? 0 : CONFIRM_MS);
  }

  return (
    <Screen className={styles.screen}>
      <div className={styles.progressHead}>
        <span className={styles.phase}>{QUESTION_LABEL}</span>
        <span className={styles.count}>
          <span className={styles.countNumber}>{index + 1}</span> de {total}
        </span>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label={QUESTION_LABEL}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
      >
        <span style={{ transform: `scaleX(${index / total})` }} />
      </div>

      <div className={styles.question}>
        <p className={styles.context}>{CONTEXT[item.context]}</p>
        <h1 ref={headingRef} tabIndex={-1} className={styles.text}>
          {item.text}
        </h1>
        <div className={styles.options}>
          {item.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.option}
              aria-pressed={chosen === option.id}
              disabled={chosen !== null && chosen !== option.id}
              onClick={() => choose(option.id)}
            >
              <span className={styles.mark} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}

const PENDING_NOTE = {
  sending: 'Calculando tu resultado oficial…',
  'saved-offline':
    'Sin señal: este es tu podio provisional. Tu test quedó guardado en este celular y se envía cuando tengas señal y abras la app.',
  'needs-auth':
    'Tu sesión venció. Tu test sigue guardado en el celular: entra de nuevo y se envía solo.',
} as const;

function Submitted({
  status,
  format,
  onRestart,
}: {
  status: SubmitStatus;
  format: MatchFormat;
  onRestart: () => void;
}) {
  if (status.kind === 'rejected') {
    return (
      <Screen className={styles.screen}>
        <div className={styles.intro}>
          <h1 className={styles.display}>No pudimos validar tu test</h1>
          <p className={styles.lead}>Algo no cuadró al revisarlo. Hazlo de nuevo, por favor.</p>
        </div>
        <div className={styles.actions}>
          <Button onClick={onRestart}>Hacer el test de nuevo</Button>
          <Link to="/" className={styles.back}>
            Volver al inicio
          </Link>
        </div>
      </Screen>
    );
  }

  const official = status.kind === 'scored';
  const podium = official ? status.result.ranking.slice(0, 3) : status.provisionalPodium;

  return (
    <Screen className={styles.screen}>
      {/* La clave cambia al llegar el oficial: el podio se vuelve a revelar con los datos buenos. */}
      <ResultView
        key={official ? 'official' : 'provisional'}
        format={format}
        podium={podium}
        provisional={!official}
      />
      {!official && (
        <p className={styles.note} role="status">
          {PENDING_NOTE[status.kind]}
        </p>
      )}
      {status.kind === 'needs-auth' ? (
        <ButtonLink to="/entrar">Entrar</ButtonLink>
      ) : official ? (
        <ButtonLink to="/">Volver al inicio</ButtonLink>
      ) : (
        <Link to="/" className={styles.back}>
          Volver al inicio
        </Link>
      )}
    </Screen>
  );
}
