import type { GuardianRelationship, InvitationPreviewResponse } from '@sdl/contracts';
import { GUARDIAN_AUTHORIZATION_VERSION } from '@sdl/contracts';
import { childWord, formatBirthYears } from '@sdl/domain';
import { lazy, Suspense, useId, useRef, useState, type FormEvent } from 'react';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import { ConsentForm } from '../consent/ConsentForm';
import { firstName, kidPath } from '../family/family-nav';
import { NoticesPrompt } from '../family/NoticesPrompt';
import styles from './GuardianJoin.module.css';
import joinStyles from './JoinPage.module.css';
import { SignInActions } from './JoinPage';
import { errorMessage } from './use-join';
import { minorYears, useRegisterMinor } from './use-guardian-join';

// El texto completo solo se descarga si la persona lo despliega.
const AuthorizationText = lazy(() =>
  import('../consent/AuthorizationText').then((m) => ({ default: m.AuthorizationText })),
);

const RELATIONSHIPS: readonly { value: GuardianRelationship; label: string }[] = [
  { value: 'mother', label: 'Mamá' },
  { value: 'father', label: 'Papá' },
  { value: 'guardian', label: 'Acudiente' },
];

/**
 * /unirse/:code con un enlace para acudientes (escuelas, 2026-11-10, registro familia): el
 * acudiente entra con su Google, acepta la política (si no la tenía) y la autorización del
 * representante legal, y da el nombre y el año de su hijo. El niño no tiene cuenta.
 */
export function GuardianJoin({
  code,
  me,
  invitation,
}: {
  code: string;
  me: Me | null;
  invitation: InvitationPreviewResponse;
}) {
  const register = useRegisterMinor(code);
  const [step, setStep] = useState<'invitation' | 'consent' | 'child'>(
    me?.consent ? 'child' : 'invitation',
  );
  const [registered, setRegistered] = useState<{ name: string; minorId: string } | null>(null);
  const kid = childWord(invitation.gender);

  if (registered) {
    return (
      <Done
        invitation={invitation}
        name={registered.name}
        minorId={registered.minorId}
        onAnother={() => {
          register.reset();
          setRegistered(null);
        }}
      />
    );
  }

  if (!me || step === 'invitation') {
    return (
      <Screen className={joinStyles.screen}>
        <Invitation invitation={invitation} />
        <div className={joinStyles.body}>
          <ol className={styles.steps}>
            <li>Entras con tu cuenta de Google. {capitalize(kid)} no necesita cuenta.</li>
            <li>Autorizas, como su acudiente, que la escuela guarde sus datos.</li>
            <li>Escribes su nombre y su año de nacimiento. Nada más.</li>
          </ol>
          {me ? (
            <Button onClick={() => setStep(me.consent ? 'child' : 'consent')}>Empezar</Button>
          ) : (
            <SignInActions returnTo={`/unirse/${code}`} />
          )}
        </div>
      </Screen>
    );
  }

  if (step === 'consent' && !me.consent) {
    return (
      <Screen className={joinStyles.screen}>
        <div className={joinStyles.body}>
          <h1 className={joinStyles.title}>Primero, tus datos</h1>
          <p className={joinStyles.lead}>
            Esto es lo que guardamos de ti y para qué. Lo de {kid} viene en el siguiente paso.
          </p>
          <ConsentForm
            submitLabel="Acepto y sigo"
            busy={false}
            error={null}
            onAccept={() => setStep('child')}
          />
        </div>
      </Screen>
    );
  }

  return (
    <ChildForm
      invitation={invitation}
      busy={register.isPending}
      error={register.isError ? errorMessage(register.error) : null}
      onBack={() => setStep('invitation')}
      onSubmit={(child, relationship) =>
        register.mutate(
          {
            // Si aceptó la política en el paso anterior, se guarda ahora, junto con el niño.
            withConsent: !me.consent,
            request: {
              child,
              relationship,
              authorizationVersion: GUARDIAN_AUTHORIZATION_VERSION,
            },
          },
          {
            onSuccess: ({ minorId }) => setRegistered({ name: firstName(child.name), minorId }),
          },
        )
      }
    />
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** El bloque cobalto: la escuela invita a inscribir al niño en el grupo, con sus años. */
function Invitation({ invitation }: { invitation: InvitationPreviewResponse }) {
  return (
    <header className={joinStyles.convocation}>
      <p className={joinStyles.eyebrow}>Inscripción</p>
      <p className={joinStyles.club}>
        <span translate="no">{invitation.club.name}</span> te invita a inscribir a{' '}
        {childWord(invitation.gender)} en
      </p>
      <h1 className={joinStyles.team} translate="no">
        {invitation.team.name}
      </h1>
      {invitation.birthYears && (
        <p className={styles.years}>
          Nacidos en <b>{formatBirthYears(invitation.birthYears)}</b>
        </p>
      )}
    </header>
  );
}

function ChildForm({
  invitation,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  invitation: InvitationPreviewResponse;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (
    child: { name: string; birthYear: number },
    relationship: GuardianRelationship,
  ) => void;
}) {
  const id = useId();
  const years = minorYears(invitation.birthYears, new Date().getFullYear());
  const [name, setName] = useState('');
  const [year, setYear] = useState<number | null>(years.length === 1 ? years[0]! : null);
  const [relationship, setRelationship] = useState<GuardianRelationship | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const kid = childWord(invitation.gender);
  const trimmed = name.trim();
  const missing = {
    name: trimmed.length < 2,
    year: year === null,
    relationship: relationship === null,
    authorized: !authorized,
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (Object.values(missing).some(Boolean) || year === null || !relationship) {
      // El foco va al primer campo que falta (el nombre, el año, quién es o la casilla).
      const first = missing.name
        ? 'input[name="nombre"]'
        : missing.year
          ? '[data-field="year"] button'
          : missing.relationship
            ? '[data-field="relationship"] button'
            : 'input[type="checkbox"]';
      formRef.current?.querySelector<HTMLElement>(first)?.focus();
      return;
    }
    onSubmit({ name: trimmed, birthYear: year }, relationship);
  }

  return (
    <Screen className={styles.screen}>
      <button type="button" className={styles.back} onClick={onBack}>
        Volver
      </button>
      <header>
        <p className={styles.eyebrow} translate="no">
          {invitation.team.name}
        </p>
        <h1 className={styles.title}>Inscribe a {kid}</h1>
      </header>
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor={`${id}-nombre`} className={styles.label}>
            Su nombre
          </label>
          <input
            id={`${id}-nombre`}
            name="nombre"
            className={styles.input}
            value={name}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="words"
            aria-invalid={tried && missing.name}
            aria-describedby={`${id}-nombre-pista`}
            onChange={(event) => setName(event.target.value)}
          />
          <p
            id={`${id}-nombre-pista`}
            className={tried && missing.name ? styles.error : styles.hint}
          >
            {tried && missing.name ? 'Escribe su nombre.' : 'Su nombre y apellido.'}
          </p>
        </div>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Año en que nació</legend>
          <div className={styles.options} data-field="year">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={styles.option}
                data-numeric=""
                aria-pressed={year === y}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          {tried && missing.year && <p className={styles.error}>Elige el año.</p>}
        </fieldset>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Tú eres su</legend>
          <div className={styles.options} data-field="relationship">
            {RELATIONSHIPS.map((r) => (
              <button
                key={r.value}
                type="button"
                className={styles.option}
                aria-pressed={relationship === r.value}
                onClick={() => setRelationship(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {tried && missing.relationship && <p className={styles.error}>Elige una.</p>}
        </fieldset>

        <div className={styles.authorization}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={authorized}
              aria-invalid={tried && missing.authorized}
              onChange={(event) => setAuthorized(event.target.checked)}
            />
            <span>
              Soy su representante legal y autorizo a{' '}
              <span translate="no">{invitation.club.name}</span> a guardar su nombre, su año de
              nacimiento y lo que haga en la escuela.
            </span>
          </label>
          <details
            className={styles.details}
            onToggle={(event) => setTextOpen(event.currentTarget.open)}
          >
            <summary>Leer la autorización completa</summary>
            {textOpen && (
              <Suspense fallback={<p role="status">Cargando la autorización…</p>}>
                <AuthorizationText />
              </Suspense>
            )}
          </details>
          {tried && missing.authorized && (
            <p className={styles.error}>Sin tu autorización no podemos hacer la inscripción.</p>
          )}
        </div>

        {error && (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        )}
        <Button type="submit" busy={busy}>
          {busy ? 'Inscribiendo…' : trimmed ? `Inscribir a ${firstName(trimmed)}` : 'Inscribir'}
        </Button>
      </form>
    </Screen>
  );
}

function Done({
  invitation,
  name,
  minorId,
  onAnother,
}: {
  invitation: InvitationPreviewResponse;
  name: string;
  minorId: string;
  onAnother: () => void;
}) {
  return (
    <Screen className={joinStyles.screen}>
      <header className={joinStyles.convocation}>
        <p className={joinStyles.eyebrow} translate="no">
          {invitation.club.name}
        </p>
        <p className={joinStyles.club} translate="no">
          {invitation.team.name}
        </p>
        <h1 className={joinStyles.team}>{name} ya está en el grupo</h1>
      </header>
      <div className={joinStyles.body}>
        <p className={joinStyles.lead}>
          Ya aparece en la lista de su profe. Cuando haya un entreno o un partido, te avisamos para
          que respondas por {name}.
        </p>
        <NoticesPrompt name={name} />
        <ButtonLink to={kidPath({ id: minorId, teamId: invitation.team.id })} variant="accent">
          Ver lo de {name}
        </ButtonLink>
        <Button variant="secondary" onClick={onAnother}>
          Inscribir a otro hijo
        </Button>
      </div>
    </Screen>
  );
}
