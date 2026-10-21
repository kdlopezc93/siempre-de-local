import type { SpikeQuestionnaire } from '@sdl/contracts';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import type { CurrentUser } from '../../shared/api/auth';
import { clearSent, type FlushOutcome, type OutboxItem } from '../../shared/offline/outbox';
import { useOnline, useOutbox } from '../../shared/offline/use-outbox';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import styles from './SpikePwaPage.module.css';
import { useDeviceState, useSpikeQuestionnaire, useSpikeSubmit } from './use-spike-pwa';

/**
 * TEMPORAL · pantalla de diagnóstico del spike PWA (docs/spikes/pwa.md).
 * Se borra junto con el módulo spike-pwa del API.
 */
export function SpikePwaPage({ user }: { user: CurrentUser }) {
  const online = useOnline();
  const device = useDeviceState();
  const questionnaire = useSpikeQuestionnaire();
  const { submit, flush } = useSpikeSubmit(user.id);
  const outbox = useOutbox();
  const items = outbox.items.filter((item) => item.userId === user.id);

  return (
    <Screen>
      <div className={styles.content}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Prueba temporal</p>
          <h1 className={styles.title}>PWA sin conexión</h1>
        </header>

        <section aria-labelledby="estado">
          <h2 id="estado" className={styles.heading}>
            Este celular
          </h2>
          <dl className={styles.facts}>
            <Fact label="Conexión" value={online ? 'Con red' : 'Sin red'} ok={online} />
            <Fact
              label="Abierta como"
              value={device.installed ? 'App instalada' : 'Navegador'}
              ok={device.installed}
            />
            <Fact
              label="Service worker"
              value={device.serviceWorker ? 'Activo' : 'Todavía no'}
              ok={device.serviceWorker}
            />
            <Fact
              label="Datos protegidos"
              value={
                device.persisted === null ? 'No disponible' : device.persisted ? 'Sí' : 'No aún'
              }
              ok={device.persisted === true}
            />
          </dl>
        </section>

        <section aria-labelledby="cuestionario">
          <h2 id="cuestionario" className={styles.heading}>
            Cuestionario
          </h2>
          {questionnaire.isPending && <p role="status">Cargando cuestionario…</p>}
          {questionnaire.isError && (
            <p role="alert" className={styles.alert}>
              No hay copia guardada del cuestionario. Ábrelo una vez con red.
            </p>
          )}
          {questionnaire.data && (
            <QuestionnaireForm questionnaire={questionnaire.data} onSubmit={submit} />
          )}
        </section>

        <section aria-labelledby="cola">
          <h2 id="cola" className={styles.heading}>
            Envíos
          </h2>
          <p className={styles.muted} aria-live="polite">
            {describeOutcome(outbox.lastOutcome)}
          </p>
          {items.length === 0 ? (
            <p className={styles.muted}>Todavía no has enviado nada.</p>
          ) : (
            <ol className={styles.outbox}>
              {items.map((item) => (
                <OutboxRow key={item.id} item={item} />
              ))}
            </ol>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void flush()}>
              Enviar pendientes
            </Button>
            <Button variant="ghost" onClick={() => void clearSent()}>
              Borrar los ya enviados
            </Button>
          </div>
        </section>

        <Link to="/" className={styles.back}>
          Volver al inicio
        </Link>
      </div>
    </Screen>
  );
}

function Fact({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd className={ok ? styles.ok : styles.warn}>{value}</dd>
    </div>
  );
}

type Answers = Record<string, string>;

function QuestionnaireForm({
  questionnaire,
  onSubmit,
}: {
  questionnaire: SpikeQuestionnaire;
  onSubmit: (attempt: {
    questionnaireVersion: string;
    answers: { questionId: string; optionId: string }[];
  }) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);
  const complete = questionnaire.questions.every((q) => answers[q.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        questionnaireVersion: questionnaire.version,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      });
      setAnswers({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      {questionnaire.questions.map((question) => (
        <fieldset key={question.id} className={styles.question}>
          <legend className={styles.prompt}>{question.prompt}</legend>
          {question.options.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="radio"
                name={question.id}
                value={option.id}
                checked={answers[question.id] === option.id}
                onChange={() => setAnswers((a) => ({ ...a, [question.id]: option.id }))}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <Button type="submit" disabled={!complete} busy={saving}>
        Guardar respuestas
      </Button>
      <p className={styles.muted}>
        Versión <span translate="no">{questionnaire.version}</span>
      </p>
    </form>
  );
}

const STATUS_LABEL: Record<OutboxItem['status'], string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  rejected: 'Rechazado',
};

const TIME = new Intl.DateTimeFormat('es-419', { hour: '2-digit', minute: '2-digit' });

function OutboxRow({ item }: { item: OutboxItem }) {
  const statusClass =
    item.status === 'sent' ? styles.ok : item.status === 'rejected' ? styles.danger : styles.warn;
  return (
    <li className={styles.outboxItem}>
      <span className={statusClass}>{STATUS_LABEL[item.status]}</span>
      <span className={styles.muted}>
        Guardado {TIME.format(new Date(item.createdAt))}
        {item.sentAt && ` · enviado ${TIME.format(new Date(item.sentAt))}`}
        {item.tries > 0 &&
          item.status !== 'sent' &&
          ` · ${item.tries} ${item.tries === 1 ? 'intento' : 'intentos'}`}
      </span>
      {item.lastError && item.status !== 'sent' && (
        <span className={styles.muted}>Último error: {item.lastError}</span>
      )}
    </li>
  );
}

function describeOutcome(outcome: FlushOutcome | null): string {
  switch (outcome) {
    case 'offline':
      return 'Sin red: se envía solo cuando vuelva la conexión.';
    case 'needs-auth':
      return 'Tu sesión venció. Entra de nuevo para enviar lo pendiente.';
    case 'retry-later':
      return 'El servidor no respondió bien; se reintenta más tarde.';
    default:
      return '';
  }
}
