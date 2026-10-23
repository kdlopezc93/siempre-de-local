import type { MatchFormat } from '@sdl/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { PhotoPicker } from '../../shared/ui/PhotoPicker';
import { initialsOf } from '../../shared/ui/TeamHeader';
import { Token } from '../../shared/ui/Token';
import { useTeamPhoto } from '../photos/use-photos';
import { SESSION_KEY } from '../auth/use-session';
import { useUpdateTeam } from '../card/use-card';
import { FORMAT_LABEL, formatsLabel } from '../shell/shell-nav';
import { useTeam } from '../team-admin/use-invitations';
import styles from './TeamPage.module.css';

const ALL: MatchFormat[] = ['F11', 'F8'];

/**
 * Datos del equipo (07 §4.6): nombre y formatos en que juega, con el principal (D14). Los
 * edita el coach o el admin del club; los demás los ven.
 */
export function TeamData({ teamId, editable }: { teamId: string; editable: boolean }) {
  const team = useTeam(teamId);
  const [editing, setEditing] = useState(false);
  if (!team.data) return null;
  const t = team.data.team;
  return (
    <section aria-labelledby="datos" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="datos" className={styles.sectionTitle}>
          Datos del equipo
        </h2>
        {editable && !editing && (
          <button type="button" className={styles.textButton} onClick={() => setEditing(true)}>
            Editar
          </button>
        )}
      </div>
      <TeamPhoto teamId={teamId} name={t.name} photoUrl={t.photoUrl} editable={editable} />
      {editing ? (
        <TeamDataForm
          teamId={teamId}
          initial={{ name: t.name, format: t.format, formats: t.formats }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <dl className={styles.facts}>
          <div>
            <dt>Nombre</dt>
            <dd>{t.name}</dd>
          </div>
          <div>
            <dt>Juega</dt>
            <dd>{formatsLabel(t.formats, t.format)}</dd>
          </div>
          {t.formats.length > 1 && (
            <div>
              <dt>Principal</dt>
              <dd>{FORMAT_LABEL[t.format]}</dd>
            </div>
          )}
          <div>
            <dt>Temporada</dt>
            <dd>{t.season}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function TeamDataForm({
  teamId,
  initial,
  onDone,
}: {
  teamId: string;
  initial: { name: string; format: MatchFormat; formats: MatchFormat[] };
  onDone: () => void;
}) {
  const update = useUpdateTeam(teamId);
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [formats, setFormats] = useState<MatchFormat[]>(initial.formats);
  const [format, setFormat] = useState<MatchFormat>(initial.format);
  const [invalid, setInvalid] = useState<string | null>(null);
  const nameId = useId();
  // El principal siempre entre los marcados.
  const principal = formats.includes(format) ? format : (formats[0] ?? format);

  function toggle(f: MatchFormat) {
    setFormats((prev) =>
      prev.includes(f)
        ? prev.filter((x) => x !== f)
        : ALL.filter((x) => x === f || prev.includes(x)),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return setInvalid('Escribe el nombre del equipo.');
    if (formats.length === 0) return setInvalid('Marca al menos un formato.');
    setInvalid(null);
    update.mutate(
      { name: name.trim(), formats, format: principal },
      {
        onSuccess: () => {
          // El nombre y los formatos también salen en el encabezado (vienen de /me).
          void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
          onDone();
        },
      },
    );
  }

  const error =
    invalid ??
    (update.error instanceof ApiError && update.error.status < 500
      ? update.error.message
      : update.isError
        ? 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.'
        : null);

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={nameId} className={styles.label}>
        Nombre
      </label>
      <input
        id={nameId}
        name="name"
        autoComplete="off"
        maxLength={60}
        className={styles.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Formatos en que juega</legend>
        {ALL.map((f) => (
          <label key={f} className={styles.check}>
            <input type="checkbox" checked={formats.includes(f)} onChange={() => toggle(f)} />
            <span>{FORMAT_LABEL[f]}</span>
          </label>
        ))}
      </fieldset>
      {formats.length > 1 && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>
            ¿Cuál es el principal?
            <span className={styles.hint}>El del test, la valoración y la tarjeta.</span>
          </legend>
          {formats.map((f) => (
            <label key={f} className={styles.check}>
              <input
                type="radio"
                name="principal"
                checked={principal === f}
                onChange={() => setFormat(f)}
              />
              <span>{FORMAT_LABEL[f]}</span>
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="submit" busy={update.isPending}>
          Guardar
        </Button>
        <Button variant="ghost" disabled={update.isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Escudo o foto del equipo (07 §4.7): la ponen el coach o el admin del club. */
function TeamPhoto({
  teamId,
  name,
  photoUrl,
  editable,
}: {
  teamId: string;
  name: string;
  photoUrl: string | null;
  editable: boolean;
}) {
  const photo = useTeamPhoto(teamId);
  if (!editable) {
    return photoUrl ? (
      <Token text={initialsOf(name)} tone="amber" size="lg" photo={photoUrl} />
    ) : null;
  }
  return (
    <PhotoPicker
      label="Elegir el escudo o la foto del equipo"
      current={photoUrl}
      fallback={initialsOf(name)}
      busy={photo.upload.isPending || photo.remove.isPending}
      error={photo.error}
      onUpload={(blob, done) => photo.upload.mutate(blob, { onSuccess: done })}
      onRemove={() => photo.remove.mutate()}
    />
  );
}
