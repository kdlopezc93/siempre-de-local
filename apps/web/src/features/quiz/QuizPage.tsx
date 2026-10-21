import { POSITIONS } from '@sdl/domain';
import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { CONTEXT, FORMAT, PREP_BAND } from './labels';
import type { ShownItem } from './quiz-engine';
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
  const inProgress = quiz.state !== null && quiz.state.phase !== 'done';
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

  if (!quiz.state) {
    return <Intro team={team} quiz={quiz} />;
  }
  if (quiz.state.phase === 'done') {
    return <Submitted status={quiz.submit!} onRestart={quiz.restart} />;
  }

  const { phase, index } = quiz.state;
  const items = phase === 'position' ? quiz.state.positionItems : quiz.state.prepItems;
  const label =
    phase === 'position'
      ? 'Tu posición'
      : `Preparación de ${POSITIONS[quiz.state.winner!].name.toLowerCase()}`;
  return (
    <Question
      key={items[index]!.id}
      label={label}
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
      <div className={styles.intro}>
        <h1 className={styles.display}>¿Dónde deberías jugar?</h1>
        <p className={styles.lead}>
          Son 23 preguntas: 15 sobre situaciones de juego y tus cualidades, y 8 sobre lo que sabes
          de tu posición. Toma unos 5 minutos.
        </p>
        <p className={styles.meta}>
          {team.name}, {FORMAT[team.format]}
        </p>
      </div>
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
      </div>
    </Screen>
  );
}

/** Pausa breve tras tocar una opción: se ve la elección antes de pasar a la siguiente. */
const CONFIRM_MS = 220;

function Question({
  label,
  index,
  total,
  item,
  onChoose,
}: {
  label: string;
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
        <span className={styles.phase}>{label}</span>
        <span className={styles.count}>
          {index + 1} de {total}
        </span>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
      >
        <span style={{ transform: `scaleX(${index / total})` }} />
      </div>

      <div className={styles.question}>
        {item.context && <p className={styles.context}>{CONTEXT[item.context]}</p>}
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

function Submitted({ status, onRestart }: { status: SubmitStatus; onRestart: () => void }) {
  if (status.kind === 'scored') {
    const { winner, prep } = status.result;
    return (
      <Screen className={styles.screen}>
        <div className={styles.intro}>
          <p className={styles.meta}>Tu posición</p>
          <h1 className={styles.display}>{POSITIONS[winner].name}</h1>
          <p className={styles.lead}>
            Preparación: {PREP_BAND[prep.band].toLowerCase()} ({prep.score} de {prep.total}).
          </p>
          <p className={styles.note}>Muy pronto vas a ver aquí tu pizarra y tu podio completo.</p>
        </div>
        <Link to="/" className={styles.primaryLink}>
          Volver al inicio
        </Link>
      </Screen>
    );
  }

  const copy = {
    sending: ['Calculando tu resultado…', 'Un momento: lo estamos calculando con tus respuestas.'],
    'saved-offline': [
      'Tu test quedó guardado',
      'No hay señal ahora. Lo enviamos solito cuando vuelva la conexión, y ahí ves tu resultado.',
    ],
    'needs-auth': [
      'Entra de nuevo para enviarlo',
      'Tu sesión venció. Tu test sigue guardado en el celular: entra y se envía solo.',
    ],
    rejected: [
      'No pudimos validar tu test',
      'Algo no cuadró al revisarlo. Hazlo de nuevo, por favor.',
    ],
  } as const;
  const [title, lead] = copy[status.kind];

  return (
    <Screen className={styles.screen}>
      <div className={styles.intro}>
        <h1 className={styles.display} aria-live="polite">
          {title}
        </h1>
        <p className={styles.lead}>{lead}</p>
      </div>
      <div className={styles.actions}>
        {status.kind === 'rejected' && <Button onClick={onRestart}>Hacer el test de nuevo</Button>}
        {status.kind === 'needs-auth' ? (
          <Link to="/entrar" className={styles.primaryLink}>
            Entrar
          </Link>
        ) : (
          <Link to="/" className={styles.back}>
            Volver al inicio
          </Link>
        )}
      </div>
    </Screen>
  );
}
