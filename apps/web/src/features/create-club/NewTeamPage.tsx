import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { createTeam } from '../../shared/api/club-codes';
import { Button } from '../../shared/ui/Button';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import { Segmented } from '../../shared/ui/Segmented';
import { SESSION_KEY } from '../auth/use-session';
import { errorMessage } from '../join/use-join';
import styles from './CreateClubPage.module.css';
import { emptyTeam, TeamFields, teamProblem, teamRequest } from './TeamFields';

type Coach = 'me' | 'someone';

/**
 * /clubes/:clubId/nuevo-equipo — otro equipo del club (Kevin, 2026-10-29): lo crea el dueño o un
 * admin y queda de entrenador. Si lo va a entrenar otra persona, sigue a invitarla como
 * entrenador; al aceptar se pasa el mando. Hasta 3 equipos activos por club.
 */
export function NewTeamPage({ me, clubId }: { me: Me; clubId: string }) {
  const club = me.clubs.find((c) => c.id === clubId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [team, setTeam] = useState(emptyTeam);
  const [coach, setCoach] = useState<Coach>('me');
  const [invalid, setInvalid] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => createTeam(clubId, teamRequest(team)),
    onSuccess: async ({ teamId }) => {
      // El equipo nuevo llega en /me (el selector de arriba).
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      void navigate(`/equipos/${teamId}/invitar${coach === 'someone' ? '?para=entrenador' : ''}`);
    },
  });

  if (!club) {
    return (
      <Screen className={styles.screen}>
        <PageTitle eyebrow="Club" title="Nuevo equipo" />
        <p role="alert" className={styles.lead}>
          Solo el dueño y los admins del club crean equipos.
        </p>
      </Screen>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = teamProblem(team);
    setInvalid(problem);
    if (!problem) create.mutate();
  }

  const error = invalid ?? (create.isError ? errorMessage(create.error) : null);
  return (
    <Screen className={styles.screen}>
      <button type="button" className={styles.backButton} onClick={() => void navigate(-1)}>
        Volver
      </button>
      <header>
        <PageTitle eyebrow={club.name} title="Nuevo equipo" />
        <p className={styles.lead}>
          Otra categoría, el de los jueves… Cada club tiene hasta 3 equipos.
        </p>
      </header>
      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.card}>
          <legend className={styles.legend}>El equipo</legend>
          <TeamFields value={team} onChange={setTeam} />
        </fieldset>
        <fieldset className={styles.card}>
          <legend className={styles.legend}>¿Quién lo entrena?</legend>
          <Segmented
            label="Quién lo entrena"
            options={[
              { value: 'me', label: 'Yo' },
              { value: 'someone', label: 'Otra persona' },
            ]}
            value={coach}
            onChange={setCoach}
          />
          <p className={styles.hint}>
            {coach === 'me'
              ? 'Quedas de entrenador. Después invitas a tus jugadores.'
              : 'Después te llevamos a invitarla como entrenador. Mientras acepta, quedas tú; al aceptar, pasas a asistente.'}
          </p>
        </fieldset>
        {error && (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        )}
        <Button type="submit" busy={create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear equipo'}
        </Button>
      </form>
    </Screen>
  );
}
