import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { fetchAttempt } from '../../shared/api/quiz';
import { Screen } from '../../shared/ui/Screen';
import styles from './ResultPage.module.css';
import { ResultView } from './ResultView';

/** /resultados/:attemptId — un resultado oficial ya guardado (desde el historial). */
export function ResultPage({ attemptId }: { attemptId: string }) {
  const attempt = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => fetchAttempt(attemptId),
    // Un resultado oficial no cambia.
    staleTime: Infinity,
  });

  return (
    <Screen className={styles.screen}>
      <Link to="/" className={styles.back}>
        Volver al inicio
      </Link>
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
        />
      )}
    </Screen>
  );
}
