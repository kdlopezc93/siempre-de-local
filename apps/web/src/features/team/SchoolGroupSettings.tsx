import type { CategoryGender, TeamResponse } from '@sdl/contracts';
import { useId, useState } from 'react';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Segmented } from '../../shared/ui/Segmented';
import { useSession } from '../auth/use-session';
import { useUpdateTeam } from '../card/use-card';
import { useClub } from '../club/use-club';
import styles from './TeamPage.module.css';

/**
 * El grupo de una escuela (2026-11-07): su género y su sede. La sede la eligen quienes manejan
 * la escuela (ven sus sedes); el profe cambia el género.
 */
export function SchoolGroupSettings({
  teamId,
  team,
}: {
  teamId: string;
  team: TeamResponse['team'];
}) {
  const session = useSession();
  const managesSchool = Boolean(session.data?.clubs.some((c) => c.id === team.club.id));
  const club = useClub(team.club.id, { enabled: managesSchool });
  const update = useUpdateTeam(teamId);
  const [gender, setGender] = useState<CategoryGender>(team.gender ?? 'mixed');
  const [venueId, setVenueId] = useState(team.venue?.id ?? '');
  const venueSelect = useId();
  const changed = gender !== (team.gender ?? 'mixed') || venueId !== (team.venue?.id ?? '');

  const error =
    update.error instanceof ApiError && update.error.status < 500
      ? update.error.message
      : update.isError
        ? 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.'
        : null;

  return (
    <section aria-labelledby="grupo" className={styles.section}>
      <h2 id="grupo" className={styles.sectionTitle}>
        El grupo
      </h2>
      <span className={styles.label}>Género</span>
      <Segmented
        label="Género del grupo"
        options={[
          { value: 'male', label: 'Masculino' },
          { value: 'female', label: 'Femenino' },
          { value: 'mixed', label: 'Mixto' },
        ]}
        value={gender}
        onChange={setGender}
      />
      {club.data && club.data.venues.length > 0 && (
        <>
          <label htmlFor={venueSelect} className={styles.label}>
            Sede
          </label>
          <select
            id={venueSelect}
            className={styles.input}
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
          >
            <option value="">Sin sede</option>
            {club.data.venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p role="status" className={styles.hint}>
        {update.isSuccess && !changed ? 'Guardado.' : ''}
      </p>
      {changed && (
        <Button
          busy={update.isPending}
          onClick={() =>
            update.mutate({
              ...(gender !== team.gender ? { gender } : {}),
              ...(venueId !== (team.venue?.id ?? '') ? { venueId: venueId || null } : {}),
            })
          }
        >
          Guardar
        </Button>
      )}
    </section>
  );
}
