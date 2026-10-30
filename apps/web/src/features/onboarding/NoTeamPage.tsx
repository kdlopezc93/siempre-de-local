import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useSignOut } from '../auth/use-session';
import styles from './Onboarding.module.css';

/** El código se escribe como venga: minúsculas, espacios o guiones. */
const normalize = (raw: string) => raw.toUpperCase().replace(/[^0-9A-Z]/g, '');

/** Entró con Google pero ningún equipo lo ha convocado todavía. */
export function NoTeamPage({ email }: { email: string }) {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = normalize(code);
    if (clean.length !== 10) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    void navigate(`/unirse/${clean}`);
  }

  return (
    <Screen className={styles.screen}>
      <div className={styles.body}>
        <h1 className={styles.title}>Todavía no tienes equipo</h1>
        <p className={styles.lead}>
          Para entrar necesitas la invitación de tu entrenador. Abre el enlace que te mandó desde
          este celular, o escribe aquí el código.
        </p>

        <form className={styles.codeForm} onSubmit={handleSubmit} noValidate>
          <label htmlFor={inputId} className={styles.label}>
            Código de invitación
          </label>
          <input
            ref={inputRef}
            id={inputId}
            name="invitation-code"
            className={styles.input}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setInvalid(false);
            }}
            placeholder="Ej.: K7Q2M9XDAB…"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={invalid}
            aria-describedby={invalid ? hintId : undefined}
          />
          {invalid && (
            <p id={hintId} className={styles.fieldError}>
              El código tiene 10 letras y números. Revísalo en el mensaje de tu entrenador.
            </p>
          )}
          <Button type="submit" variant="secondary">
            Usar código
          </Button>
        </form>
        <p className={styles.note}>
          ¿Vas a armar tu propio equipo?{' '}
          <Link to="/crear-club" className={styles.createLink}>
            Tengo un código para crear mi club
          </Link>
        </p>
      </div>

      <div className={styles.footer}>
        <p className={styles.note}>
          Entraste como{' '}
          <span className={styles.email} translate="no">
            {email}
          </span>
          .
        </p>
        <Button variant="ghost" busy={signOut.isPending} onClick={() => signOut.mutate()}>
          Cerrar sesión
        </Button>
      </div>
    </Screen>
  );
}
