import { useQuery } from '@tanstack/react-query';

import type { Me } from '../../shared/api/auth';
import { fetchAttempt } from '../../shared/api/quiz';
import { Screen } from '../../shared/ui/Screen';
import styles from './ResultPage.module.css';
import { ResultView } from './ResultView';

/** /resultados/:attemptId — un resultado oficial ya guardado (desde el historial). */
export function ResultPage({ attemptId, me }: { attemptId: string; me: Me }) {
  const attempt = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => fetchAttempt(attemptId),
    // Un resultado oficial no cambia.
    staleTime: Infinity,
  });

  return (
    <Screen className={styles.screen}>
      {attempt.isPending && (
        <p className="sr-only" role="status">
          Cargando tu resultado…
        </p>
      )}
      {attempt.isError && (
        <p role="alert" className={styles.alert}>
          No encontramos este resultado. Revisa tu conexión o vuelve al inicio.
        </p>
      )}
      {attempt.data && (
        <ResultView
          format={attempt.data.format}
          podium={attempt.data.ranking.slice(0, 3)}
          provisional={false}
          shareAs={{
            name: me.profile.displayName,
            team: me.teams.find((t) => t.team.id === attempt.data.teamId)?.team.name ?? '',
          }}
        />
      )}
    </Screen>
  );
}
