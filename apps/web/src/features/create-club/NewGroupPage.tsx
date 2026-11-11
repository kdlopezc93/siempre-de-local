import type { CategoryGender, ClubResponse } from '@sdl/contracts';
import { categoryKey, formatBirthYears, groupByCategory, suggestGroupName } from '@sdl/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { createTeam } from '../../shared/api/club-codes';
import { Button } from '../../shared/ui/Button';
import { PageTitle } from '../../shared/ui/PageTitle';
import { Screen } from '../../shared/ui/Screen';
import { Segmented } from '../../shared/ui/Segmented';
import { SESSION_KEY } from '../auth/use-session';
import { useClub } from '../club/use-club';
import { errorMessage } from '../join/use-join';
import styles from './CreateClubPage.module.css';
import {
  birthYearsOf,
  CategoryFields,
  categoryProblem,
  emptyCategory,
  emptyGroup,
  GroupFields,
  groupNameFor,
  groupProblem,
  type GroupValues,
} from './SchoolFields';

type Coach = 'me' | 'someone';
const NEW = 'nueva';

/**
 * Nuevo grupo de una escuela (Kevin, 2026-11-07): en una categoría que ya existe (con sus mismos
 * años) o en una nueva, con su género. Quien lo crea queda de profe; si lo lleva otro, sigue a
 * invitarlo y al aceptar se pasa el mando.
 */
export function NewGroupPage({ clubId, clubName }: { clubId: string; clubName: string }) {
  const club = useClub(clubId);
  if (club.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando la escuela…
        </p>
      </Screen>
    );
  }
  if (!club.data) {
    return (
      <Screen className={styles.screen}>
        <PageTitle eyebrow={clubName} title="Nuevo grupo" />
        <p role="alert" className={styles.lead}>
          No pudimos cargar la escuela. Revisa tu conexión e intenta de nuevo.
        </p>
      </Screen>
    );
  }
  return <GroupForm clubId={clubId} clubName={clubName} data={club.data} />;
}

function GroupForm({
  clubId,
  clubName,
  data,
}: {
  clubId: string;
  clubName: string;
  data: ClubResponse;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = groupByCategory(data.teams.filter((t) => !t.archived));
  const [choice, setChoice] = useState<string>(() =>
    categories[0] ? categoryKey(categories[0].category) : NEW,
  );
  const chosen = categories.find((c) => categoryKey(c.category) === choice) ?? null;
  const sameGender = (gender: CategoryGender) =>
    chosen ? chosen.groups.filter((g) => g.gender === gender).length : 0;
  const [newCategory, setNewCategory] = useState(emptyCategory);
  const [group, setGroup] = useState<GroupValues>(() => emptyGroup(sameGender));
  const [coach, setCoach] = useState<Coach>('me');
  const [invalid, setInvalid] = useState<string | null>(null);

  const categoryName = chosen ? chosen.category : newCategory.category.trim();
  const create = useMutation({
    mutationFn: () =>
      createTeam(clubId, {
        name: groupNameFor(categoryName, group),
        category: categoryName,
        birthYears: chosen ? chosen.years : birthYearsOf(newCategory),
        gender: group.gender,
        format: group.format,
        season: group.season.trim(),
        alsoPlays: false,
        ...(group.venueId ? { venueId: group.venueId } : {}),
      }),
    onSuccess: async ({ teamId }) => {
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      void navigate(`/equipos/${teamId}/invitar${coach === 'someone' ? '?para=entrenador' : ''}`);
    },
  });

  function pick(key: string) {
    setChoice(key);
    const next = categories.find((c) => categoryKey(c.category) === key) ?? null;
    const count = next ? next.groups.filter((g) => g.gender === group.gender).length : 0;
    // Con otra categoría cambia la letra sugerida, si no la escribió.
    if (!group.groupTouched) setGroup({ ...group, group: suggestGroupName(group.gender, count) });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = (chosen ? null : categoryProblem(newCategory)) ?? groupProblem(group);
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
        <PageTitle eyebrow={clubName} title="Nuevo grupo" />
      </header>
      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.card}>
          <legend className={styles.legend}>Categoría</legend>
          <div className={styles.choices}>
            {categories.map((c) => {
              const key = categoryKey(c.category);
              return (
                <label key={key} className={styles.choice}>
                  <input
                    type="radio"
                    name="categoria"
                    value={key}
                    checked={choice === key}
                    onChange={() => pick(key)}
                  />
                  <span className={styles.choiceName}>{c.category}</span>
                  <span className={styles.choiceMeta}>
                    {formatBirthYears(c.years)} ·{' '}
                    {c.groups.length === 1 ? '1 grupo' : `${c.groups.length} grupos`}
                  </span>
                </label>
              );
            })}
            <label className={styles.choice} data-new>
              <input
                type="radio"
                name="categoria"
                value={NEW}
                checked={choice === NEW}
                onChange={() => pick(NEW)}
              />
              <span className={styles.choiceName}>Nueva categoría</span>
            </label>
          </div>
          {chosen ? (
            <p className={styles.hint}>El grupo entra con los años de {chosen.category}.</p>
          ) : (
            <>
              <CategoryFields value={newCategory} onChange={setNewCategory} />
              <p className={styles.hint}>Sus años no pueden cruzarse con los de otra categoría.</p>
            </>
          )}
        </fieldset>

        <fieldset className={styles.card}>
          <legend className={styles.legend}>El grupo</legend>
          <GroupFields
            value={group}
            onChange={setGroup}
            sameGender={sameGender}
            venues={data.venues}
          />
        </fieldset>

        <fieldset className={styles.card}>
          <legend className={styles.legend}>¿Quién es el profe?</legend>
          <Segmented
            label="Quién es el profe"
            options={[
              { value: 'me', label: 'Yo' },
              { value: 'someone', label: 'Otro profe' },
            ]}
            value={coach}
            onChange={setCoach}
          />
          <p className={styles.hint}>
            {coach === 'me'
              ? 'Quedas de profe del grupo.'
              : 'Después te llevamos a invitarlo. Mientras acepta, quedas tú; al aceptar, le pasas el mando.'}
          </p>
        </fieldset>
        {error && (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        )}
        <Button type="submit" busy={create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear grupo'}
        </Button>
      </form>
    </Screen>
  );
}
