import type { MatchFormat } from '@sdl/contracts';
import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import { Segmented } from '../../shared/ui/Segmented';
import switchStyles from '../../shared/ui/Switch.module.css';
import { ConsentForm } from '../consent/ConsentForm';
import { errorMessage } from '../join/use-join';
import { SignInActions } from '../join/JoinPage';
import styles from './CreateClubPage.module.css';
import { CATEGORY_SUGGESTIONS, useClubCodePreview, useCreateClub } from './use-create-club';

/** El código se escribe como venga: minúsculas, espacios o guiones. */
const normalize = (raw: string) => raw.toUpperCase().replace(/[^0-9A-Z]/g, '');

/**
 * /crear-club/:code — crear mi club con un código de alta (Kevin, 2026-10-29): el club con su
 * ciudad o barrio y su primer equipo. Quien lo crea queda de dueño y entrenador. Sin código
 * (/crear-club), lo pide. `me` es null si no hay sesión.
 */
export function CreateClubPage({ code, me }: { code: string; me: Me | null }) {
  if (!code) return <CodeEntry />;
  return <WithCode code={normalize(code)} me={me} />;
}

function WithCode({ code, me }: { code: string; me: Me | null }) {
  const preview = useClubCodePreview(code);
  const create = useCreateClub();

  if (preview.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Revisando tu código…
        </p>
      </Screen>
    );
  }
  if (preview.isError) {
    return (
      <Screen className={styles.screen}>
        <h1 className={styles.title}>Este código no sirve</h1>
        <p className={styles.lead}>{errorMessage(preview.error)}</p>
        <Link to="/" className={styles.textLink}>
          Ir al inicio
        </Link>
      </Screen>
    );
  }
  if (create.isSuccess) {
    return (
      <Screen className={styles.screen}>
        <Banner title="¡Listo, ya tienes tu club!" />
        <div className={styles.body}>
          <p className={styles.lead}>
            Quedaste de dueño del club y entrenador del equipo. Ahora invita a tus jugadores: les
            mandas un enlace por WhatsApp y entran con Google.
          </p>
          <ButtonLink to={`/equipos/${create.data.teamId}/invitar`} variant="accent">
            Invitar a mi equipo
          </ButtonLink>
          <Link to="/" className={styles.textLink}>
            Ir al inicio
          </Link>
        </div>
      </Screen>
    );
  }
  if (!me) {
    return (
      <Screen className={styles.screen}>
        <Banner title="Arma tu club" />
        <div className={styles.body}>
          <p className={styles.lead}>
            Con este código creas tu club y tu primer equipo. Entra con tu cuenta de Google para
            empezar.
          </p>
          <SignInActions returnTo={`/crear-club/${code}`} />
        </div>
      </Screen>
    );
  }
  return <ClubForm code={code} me={me} create={create} />;
}

/** El bloque cobalto de arriba, como la convocatoria al unirse. */
function Banner({ title }: { title: string }) {
  return (
    <header className={styles.banner}>
      <p className={styles.eyebrow}>Código de alta</p>
      <h1 className={styles.bannerTitle}>{title}</h1>
    </header>
  );
}

function ClubForm({
  code,
  me,
  create,
}: {
  code: string;
  me: Me;
  create: ReturnType<typeof useCreateClub>;
}) {
  const [clubName, setClubName] = useState('');
  const [city, setCity] = useState('');
  const [teamName, setTeamName] = useState('');
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState<MatchFormat>('F8');
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [alsoPlays, setAlsoPlays] = useState(true);
  const [step, setStep] = useState<'form' | 'consent'>('form');
  const [invalid, setInvalid] = useState<string | null>(null);
  const ids = { club: useId(), city: useId(), team: useId(), category: useId(), season: useId() };

  const request = {
    code,
    clubName: clubName.trim(),
    city: city.trim(),
    teamName: teamName.trim(),
    category: category.trim() || undefined,
    format,
    season: season.trim(),
    alsoPlays,
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.clubName.length < 2) return setInvalid('Escribe el nombre del club.');
    if (request.city.length < 2) return setInvalid('Escribe la ciudad o el barrio.');
    if (request.teamName.length < 2) return setInvalid('Escribe el nombre del equipo.');
    if (request.season.length < 4) return setInvalid('Escribe la temporada, por ejemplo 2026.');
    setInvalid(null);
    // Sin la política aceptada, primero la acepta (el mismo toque que al unirse).
    if (!me.consent) return setStep('consent');
    create.mutate({ request, withConsent: false });
  }

  if (step === 'consent') {
    return (
      <Screen className={styles.screen}>
        <div className={styles.body}>
          <h1 className={styles.title}>Antes de crear tu club</h1>
          <p className={styles.lead}>Esto es lo que guardamos de ti y para qué.</p>
          <ConsentForm
            submitLabel="Acepto y creo mi club"
            busy={create.isPending}
            error={create.isError ? errorMessage(create.error) : null}
            onAccept={() => create.mutate({ request, withConsent: true })}
          />
          <Button variant="ghost" disabled={create.isPending} onClick={() => setStep('form')}>
            Volver
          </Button>
        </div>
      </Screen>
    );
  }

  const error = invalid ?? (create.isError ? errorMessage(create.error) : null);
  return (
    <Screen className={styles.screen}>
      <Banner title="Arma tu club" />
      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.card}>
          <legend className={styles.legend}>El club</legend>
          <label htmlFor={ids.club} className={styles.label}>
            Nombre del club
          </label>
          <input
            id={ids.club}
            className={styles.input}
            value={clubName}
            maxLength={60}
            autoComplete="organization"
            placeholder="Ej.: Los del Barrio"
            onChange={(event) => setClubName(event.target.value)}
          />
          <label htmlFor={ids.city} className={styles.label}>
            Ciudad o barrio
          </label>
          <input
            id={ids.city}
            className={styles.input}
            value={city}
            maxLength={60}
            autoComplete="address-level2"
            placeholder="Ej.: Bosa, Bogotá"
            onChange={(event) => setCity(event.target.value)}
          />
        </fieldset>

        <fieldset className={styles.card}>
          <legend className={styles.legend}>Tu primer equipo</legend>
          <label htmlFor={ids.team} className={styles.label}>
            Nombre del equipo
          </label>
          <input
            id={ids.team}
            className={styles.input}
            value={teamName}
            maxLength={60}
            autoComplete="off"
            placeholder="Ej.: Primer equipo"
            onChange={(event) => setTeamName(event.target.value)}
          />
          <label htmlFor={ids.category} className={styles.label}>
            Categoría (opcional)
          </label>
          <input
            id={ids.category}
            className={styles.input}
            value={category}
            maxLength={40}
            autoComplete="off"
            placeholder="Ej.: Veteranos"
            onChange={(event) => setCategory(event.target.value)}
          />
          <div className={styles.suggestions} role="group" aria-label="Sugerencias de categoría">
            {CATEGORY_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.suggestion}
                aria-pressed={category.trim() === s}
                onClick={() => setCategory(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <span className={styles.label}>Formato</span>
          <Segmented
            label="Formato"
            options={[
              { value: 'F8', label: 'Fútbol 8' },
              { value: 'F11', label: 'Fútbol 11' },
            ]}
            value={format}
            onChange={setFormat}
          />
          <label htmlFor={ids.season} className={styles.label}>
            Temporada
          </label>
          <input
            id={ids.season}
            className={styles.input}
            value={season}
            maxLength={9}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => setSeason(event.target.value)}
          />
          <label className={styles.toggle}>
            <input
              type="checkbox"
              role="switch"
              className={switchStyles.switch}
              checked={alsoPlays}
              onChange={(event) => setAlsoPlays(event.target.checked)}
            />
            <span>
              También juego en el equipo
              <span className={styles.hint}>
                {alsoPlays ? 'Eres entrenador y jugador.' : 'Solo entrenador.'}
              </span>
            </span>
          </label>
        </fieldset>

        <p className={styles.hint}>
          Quedas de dueño del club y entrenador del equipo. Después lo cambias en Equipo.
        </p>
        {error && (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        )}
        <Button type="submit" busy={create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear mi club'}
        </Button>
      </form>
    </Screen>
  );
}

/** /crear-club sin código: lo pide y sigue con él. */
function CodeEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputId = useId();
  const hintId = useId();
  return (
    <Screen className={styles.screen}>
      <Banner title="Arma tu club" />
      <form
        className={styles.body}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const clean = normalize(code);
          if (clean.length !== 10) return setInvalid(true);
          void navigate(`/crear-club/${clean}`);
        }}
      >
        <p className={styles.lead}>
          Para crear tu club necesitas un código de alta. Escríbelo aquí como te llegó.
        </p>
        <label htmlFor={inputId} className={styles.label}>
          Código de alta
        </label>
        <input
          id={inputId}
          className={styles.input}
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Ej.: K7Q2M9XDAB"
          aria-invalid={invalid}
          aria-describedby={invalid ? hintId : undefined}
          onChange={(event) => {
            setCode(event.target.value);
            setInvalid(false);
          }}
        />
        {invalid && (
          <p id={hintId} className={styles.fieldError}>
            El código tiene 10 letras y números. Revísalo en el mensaje.
          </p>
        )}
        <Button type="submit">Seguir</Button>
      </form>
    </Screen>
  );
}
