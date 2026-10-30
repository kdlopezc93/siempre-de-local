import type { InvitationPreviewResponse, TeamRole } from '@sdl/contracts';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import { GoogleMark } from '../auth/components/GoogleMark';
import { useGoogleSignIn, useSignOut } from '../auth/use-session';
import { ConsentForm } from '../consent/ConsentForm';
import styles from './JoinPage.module.css';
import { errorMessage, useInvitationPreview, useJoinTeam } from './use-join';

const ROLE: Record<TeamRole, string> = {
  player: 'jugador',
  assistant: 'asistente técnico',
  coach: 'entrenador',
};
const FORMAT = { F5: 'fútbol 5', F8: 'fútbol 8', F11: 'fútbol 11' } as const;

/** /unirse/:code — la convocatoria del entrenador. `me` es null si no hay sesión. */
export function JoinPage({ code, me }: { code: string; me: Me | null }) {
  const preview = useInvitationPreview(code);
  const join = useJoinTeam(code);
  const [step, setStep] = useState<'invitation' | 'consent'>('invitation');

  if (preview.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Buscando tu invitación…
        </p>
      </Screen>
    );
  }

  if (preview.isError) {
    return (
      <Screen className={styles.screen}>
        <h1 className={styles.title}>Este enlace no sirve</h1>
        <p className={styles.lead}>{errorMessage(preview.error)}</p>
        <Link to="/" className={styles.textLink}>
          Ir al inicio
        </Link>
      </Screen>
    );
  }

  const invitation = preview.data;

  if (join.isSuccess) {
    return (
      <Screen className={styles.screen}>
        <Convocation invitation={invitation} />
        <div className={styles.body}>
          <h1 className={styles.title}>
            {join.data.alreadyMember ? 'Ya estabas en el equipo' : 'Ya estás en el equipo'}
          </h1>
          <p className={styles.lead}>
            Tu entrenador ya te ve en la plantilla. Muy pronto vas a poder hacer tu test de posición
            desde aquí.
          </p>
          <ButtonLink to="/" variant="accent">
            Ir a mi equipo
          </ButtonLink>
        </div>
      </Screen>
    );
  }

  if (step === 'consent' && me) {
    return (
      <Screen className={styles.screen}>
        <div className={styles.body}>
          <h1 className={styles.title}>Antes de unirte</h1>
          <p className={styles.lead}>Esto es lo que guardamos de ti y para qué.</p>
          <ConsentForm
            submitLabel="Acepto y me uno"
            busy={join.isPending}
            error={join.isError ? errorMessage(join.error) : null}
            onAccept={() => join.mutate({ withConsent: true })}
          />
          <Button variant="ghost" disabled={join.isPending} onClick={() => setStep('invitation')}>
            Volver
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen className={styles.screen}>
      <Convocation invitation={invitation} asTitle />
      <div className={styles.body}>
        <p className={styles.lead}>
          Entras como {ROLE[invitation.role]}
          {invitation.alsoPlays ? ' y jugador' : ''}. El equipo juega{' '}
          {FORMAT[invitation.team.format]}.
        </p>
        {me ? (
          <SignedInActions
            me={me}
            busy={join.isPending}
            error={join.isError ? errorMessage(join.error) : null}
            onJoin={() => (me.consent ? join.mutate({ withConsent: false }) : setStep('consent'))}
          />
        ) : (
          <SignInActions returnTo={`/unirse/${code}`} />
        )}
      </div>
    </Screen>
  );
}

/**
 * La convocatoria es el bloque cobalto de la pantalla. `asTitle`: el nombre del equipo es el
 * título de la pantalla (h1) o solo contexto.
 */
function Convocation({
  invitation,
  asTitle = false,
}: {
  invitation: InvitationPreviewResponse;
  asTitle?: boolean;
}) {
  const Team = asTitle ? 'h1' : 'p';
  return (
    <header className={styles.convocation}>
      <p className={styles.eyebrow}>Convocatoria</p>
      <p className={styles.club}>
        <span translate="no">{invitation.club.name}</span> te convoca a
      </p>
      <Team className={styles.team} translate="no">
        {invitation.team.name}
      </Team>
    </header>
  );
}

/** Entrar con Google y volver a `returnTo` (también lo usa Crear mi club). */
export function SignInActions({ returnTo }: { returnTo: string }) {
  const [params] = useSearchParams();
  const signIn = useGoogleSignIn(returnTo);
  const opening = signIn.isPending || signIn.isSuccess;
  const error = signIn.isError
    ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.'
    : params.has('error')
      ? 'Google no completó el inicio de sesión. Intenta de nuevo.'
      : null;

  return (
    <div className={styles.actions}>
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
      <Button variant="secondary" busy={opening} onClick={() => signIn.mutate()}>
        <span className={styles.googleBadge}>
          <GoogleMark size={18} />
        </span>
        {opening ? 'Abriendo Google…' : 'Continuar con Google'}
      </Button>
      <p className={styles.note}>Solo usamos tu nombre y tu correo de Google.</p>
    </div>
  );
}

function SignedInActions({
  me,
  busy,
  error,
  onJoin,
}: {
  me: Me;
  busy: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  const signOut = useSignOut();
  return (
    <div className={styles.actions}>
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
      <Button busy={busy} onClick={onJoin}>
        {busy ? 'Uniéndote…' : 'Unirme al equipo'}
      </Button>
      <p className={styles.note}>
        Vas a entrar como{' '}
        <span className={styles.email} translate="no">
          {me.user.email}
        </span>
        .
      </p>
      <Button
        variant="ghost"
        busy={signOut.isPending}
        disabled={busy}
        onClick={() => signOut.mutate()}
      >
        No soy yo, usar otra cuenta
      </Button>
    </div>
  );
}
