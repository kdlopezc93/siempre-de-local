import { BAND_LABELS, POSITIONS } from '@sdl/domain';
import { useQuery } from '@tanstack/react-query';

import { fetchTeamMembers } from '../../shared/api/squad';
import { Row } from '../../shared/ui/Row';
import styles from './TeamPage.module.css';
import { Avatar } from '../../shared/ui/Avatar';

const ROLE = { coach: 'Entrenador', assistant: 'Asistente' } as const;

/**
 * Integrantes (07 §4.6): el cuerpo técnico y los jugadores, con su dorsal y su mejor banda de
 * conocimiento (D11, sin puntaje). Quien puede ver la ficha (cuerpo técnico y admin del club)
 * la abre desde aquí.
 */
export function TeamMembers({ teamId, opensSheet }: { teamId: string; opensSheet: boolean }) {
  const members = useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: () => fetchTeamMembers(teamId),
    networkMode: 'offlineFirst',
  });
  if (!members.data) {
    return members.isError ? (
      <p role="alert" className={styles.error}>
        No pudimos cargar los integrantes. Revisa tu conexión.
      </p>
    ) : null;
  }
  const { staff, players } = members.data;
  return (
    <section aria-labelledby="integrantes" className={styles.section}>
      <h2 id="integrantes" className={styles.sectionTitle}>
        Integrantes ({staff.length + players.length})
      </h2>
      {staff.length > 0 && (
        <ul className={styles.list} aria-label="Cuerpo técnico">
          {staff.map((s) => (
            <li key={`${s.userId}-${s.role}`}>
              <Row
                leading={<Avatar name={s.displayName} shape="circle" />}
                title={s.displayName}
                meta={ROLE[s.role]}
              />
            </li>
          ))}
        </ul>
      )}
      <ul className={styles.list} aria-label="Jugadores">
        {players.map((p) => (
          <li key={p.userId}>
            <Row
              {...(opensSheet ? { to: `/equipos/${teamId}/plantilla/${p.userId}` } : {})}
              leading={<Avatar name={p.displayName} injured={p.injured} />}
              title={p.displayName}
              meta={
                [
                  p.injured && 'Lesionado',
                  p.bestBand &&
                    `${BAND_LABELS[p.bestBand.band]} en ${POSITIONS[p.bestBand.position].name}`,
                ]
                  .filter(Boolean)
                  .join(', ') || undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
