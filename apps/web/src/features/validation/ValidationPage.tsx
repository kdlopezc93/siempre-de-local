import type { ValidationResponse } from '@sdl/contracts';
import { MIN_PAIRS_FOR_CORRELATION, POSITIONS, strengthOf, type Strength } from '@sdl/domain';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { fetchValidation } from '../../shared/api/validation';
import { Screen } from '../../shared/ui/Screen';
import styles from './ValidationPage.module.css';

/** Con menos valoraciones a ciegas que esto, se avisa que es temprano. */
const FEW = 10;
const percent = (part: number, total: number) => `${Math.round((part / total) * 100)}%`;
const name = (pos: keyof typeof POSITIONS) => POSITIONS[pos].name;

const STRENGTH: Record<Strength, string> = {
  strong: 'Relación fuerte',
  moderate: 'Relación moderada',
  weak: 'Relación débil',
  none: 'Sin relación clara',
};

/** /equipos/:teamId/validacion — ¿acierta el test? ¿quien más sabe tiene mejor tarjeta? */
export function ValidationPage({ teamId }: { teamId: string }) {
  const report = useQuery({
    queryKey: ['team', teamId, 'validation'],
    queryFn: () => fetchValidation(teamId),
  });
  return (
    <Screen className={styles.screen}>
      <Link to={`/equipos/${teamId}/plantilla`} className={styles.back}>
        Volver a la plantilla
      </Link>
      <header>
        <h1 className={styles.title}>Informe de validación</h1>
        <p className={styles.muted}>
          Para saber cuánto confiar en cada fuente con los datos de tu propio equipo.
        </p>
      </header>
      {report.isPending ? (
        <p className="sr-only" role="status">
          Cargando el informe…
        </p>
      ) : report.isError ? (
        <p role="alert">No pudimos cargar el informe. Revisa tu conexión e intenta de nuevo.</p>
      ) : (
        <>
          <TestSection data={report.data.testVsStaff} />
          <KnowledgeSection data={report.data.knowledgeVsCard} />
          <p className={styles.note}>
            Son datos de un solo equipo y pocas personas: sirven para ver tendencias, no para sacar
            conclusiones firmes. El test compara las posiciones de cada jugador entre sí; la tarjeta
            y el conocimiento sí comparan jugadores.
          </p>
        </>
      )}
    </Screen>
  );
}

function TestSection({ data }: { data: ValidationResponse['testVsStaff'] }) {
  const misses = data.confusion.filter((c) => c.staff !== c.test);
  return (
    <section aria-labelledby="test" className={styles.section}>
      <h2 id="test" className={styles.sectionTitle}>
        ¿Acierta el test?
      </h2>
      <p className={styles.muted}>
        Compara la posición que más le da el test a cada jugador con la que le diste en tu primera
        valoración, la que hiciste sin ver su test.
      </p>
      {data.n === 0 ? (
        <p className={styles.empty}>
          Todavía no hay valoraciones a ciegas de jugadores con test. Valora a cada jugador antes de
          mirar su test: esas son las que sirven para esto.
        </p>
      ) : (
        <>
          <dl className={styles.stats}>
            <div>
              <dt>Coincide exacto</dt>
              <dd>
                {percent(data.exact, data.n)}
                <span className={styles.of}>
                  {data.exact} de {data.n}
                </span>
              </dd>
            </div>
            <div>
              <dt>En su podio</dt>
              <dd>
                {percent(data.inPodium, data.n)}
                <span className={styles.of}>
                  {data.inPodium} de {data.n}
                </span>
              </dd>
            </div>
          </dl>
          {data.n < FEW && (
            <p className={styles.warn}>
              Con {data.n} {data.n === 1 ? 'valoración' : 'valoraciones'} todavía es temprano para
              sacar conclusiones.
            </p>
          )}
          {misses.length > 0 && (
            <>
              <h3 className={styles.subTitle}>Dónde no coinciden</h3>
              <ul className={styles.misses}>
                {misses.map((m) => (
                  <li key={`${m.staff}-${m.test}`}>
                    <span>
                      Tú: {name(m.staff)}. Test: {name(m.test)}.
                    </span>
                    <span className={styles.count}>
                      {m.count} {m.count === 1 ? 'vez' : 'veces'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

function KnowledgeSection({ data }: { data: ValidationResponse['knowledgeVsCard'] }) {
  return (
    <section aria-labelledby="conocimiento" className={styles.section}>
      <h2 id="conocimiento" className={styles.sectionTitle}>
        ¿Quien más sabe, tiene mejor tarjeta?
      </h2>
      <p className={styles.muted}>
        Por posición, el mejor examen de conocimiento de cada jugador frente a su media en la
        tarjeta.
      </p>
      {data.length === 0 ? (
        <p className={styles.empty}>
          Todavía no hay jugadores con examen de conocimiento y tarjeta a la vez.
        </p>
      ) : (
        <ul className={styles.positions}>
          {data.map((p) => (
            <li key={p.position} className={styles.position}>
              <div className={styles.positionHead}>
                <span className={styles.positionName}>{name(p.position)}</span>
                <span className={styles.muted}>
                  {p.points.length} {p.points.length === 1 ? 'jugador' : 'jugadores'}
                </span>
              </div>
              <Scatter
                points={p.points}
                label={`${name(p.position)}: conocimiento frente a tarjeta`}
              />
              <p>
                {p.rho === null
                  ? p.points.length < MIN_PAIRS_FOR_CORRELATION
                    ? `Hacen falta al menos ${MIN_PAIRS_FOR_CORRELATION} jugadores con examen y tarjeta.`
                    : 'Los datos no varían lo suficiente para decir algo.'
                  : `${STRENGTH[strengthOf(p.rho)]} (ρ = ${p.rho.toFixed(2).replace('.', ',')})${
                      strengthOf(p.rho) === 'none'
                        ? '.'
                        : p.rho > 0
                          ? ': quienes más saben de la posición suelen tener mejor tarjeta ahí.'
                          : ': quienes más saben tienen peor tarjeta ahí; vale la pena revisar por qué.'
                    }`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Puntos de tiza: conocimiento (abajo, 0–100%) frente a tarjeta (al costado, 0–99). */
function Scatter({ points, label }: { points: { pct: number; mp: number }[]; label: string }) {
  return (
    <svg viewBox="0 0 100 60" className={styles.scatter} role="img" aria-label={label}>
      <line x1="6" y1="54" x2="98" y2="54" className={styles.axis} />
      <line x1="6" y1="2" x2="6" y2="54" className={styles.axis} />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={6 + p.pct * 92}
          cy={54 - (p.mp / 99) * 52}
          r="1.8"
          className={styles.point}
        />
      ))}
      <text x="98" y="59" className={styles.axisLabel} textAnchor="end">
        conocimiento →
      </text>
      <text x="1" y="8" className={styles.axisLabel}>
        tarjeta
      </text>
    </svg>
  );
}
