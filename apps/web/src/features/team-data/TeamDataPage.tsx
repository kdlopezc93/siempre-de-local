import type { LegacyImportResponse } from '@sdl/contracts';
import { POSITIONS } from '@sdl/domain';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { useTeam } from '../team-admin/use-invitations';
import styles from './TeamDataPage.module.css';
import { CsvTooBigError, useExportTeam, useImportLegacy, useLegacyResults } from './use-team-data';

const TAKEN_ON = new Intl.DateTimeFormat('es-419', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** /equipos/:teamId/datos — sacar la plantilla en CSV y traer los resultados del prototipo. */
export function TeamDataPage({ teamId }: { teamId: string }) {
  const team = useTeam(teamId);
  const exporter = useExportTeam(teamId);

  return (
    <Screen className={styles.screen}>
      <Link to={`/equipos/${teamId}/plantilla`} className={styles.back}>
        Volver a la plantilla
      </Link>
      <header>
        <h1 className={styles.title}>Datos del equipo</h1>
        {team.data && <p className={styles.muted}>{team.data.team.name}</p>}
      </header>

      <section aria-labelledby="descargar" className={styles.section}>
        <h2 id="descargar" className={styles.sectionTitle}>
          Descargar la plantilla
        </h2>
        <p className={styles.muted}>
          Un CSV con una fila por jugador: su test, tu valoración y su tarjeta, para abrir en Excel
          o Google Sheets. No lleva notas, y los tests que todavía no ves tampoco salen.
        </p>
        {exporter.isError && (
          <p role="alert" className={styles.error}>
            {exporter.error instanceof ApiError && exporter.error.status === 403
              ? 'Solo el entrenador o el admin del club descargan los datos del equipo.'
              : 'No pudimos descargar el archivo. Revisa tu conexión e intenta de nuevo.'}
          </p>
        )}
        <Button variant="secondary" busy={exporter.isPending} onClick={() => exporter.mutate()}>
          {exporter.isPending ? 'Preparando…' : 'Descargar CSV'}
        </Button>
      </section>

      <ImportSection teamId={teamId} />
      <LegacyList teamId={teamId} />
    </Screen>
  );
}

function ImportSection({ teamId }: { teamId: string }) {
  const importer = useImportLegacy(teamId);
  const [files, setFiles] = useState<File[]>([]);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const pasteId = useId();
  const [empty, setEmpty] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0 && !pasted.trim()) {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    importer.mutate(
      { files, pasted },
      {
        onSuccess: () => {
          setFiles([]);
          setPasted('');
          if (fileInput.current) fileInput.current.value = '';
        },
      },
    );
  }

  const error = empty
    ? 'Elige un archivo o pega el contenido de un CSV.'
    : importer.error instanceof CsvTooBigError
      ? 'Es demasiado texto de una vez. Importa los archivos de a pocos.'
      : importer.error instanceof ApiError && importer.error.status === 403
        ? 'Solo el entrenador o el admin del club importan datos.'
        : importer.isError
          ? 'No pudimos importar. Revisa tu conexión e intenta de nuevo.'
          : null;

  return (
    <section aria-labelledby="importar" className={styles.section}>
      <h2 id="importar" className={styles.sectionTitle}>
        Traer los resultados del prototipo
      </h2>
      <p className={styles.muted}>
        Los CSV que descargaban tus jugadores en el test anterior, o el consolidado del panel. Se
        guardan aparte: no cuentan como test ni para validar, y los repetidos se descartan solos.
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor={fileId} className={styles.drop}>
          <span className={styles.dropTitle}>
            {files.length === 0
              ? 'Elegir los archivos CSV'
              : `${files.length} ${files.length === 1 ? 'archivo elegido' : 'archivos elegidos'}`}
          </span>
          <span className={styles.muted}>Puedes elegir varios a la vez.</span>
          <input
            ref={fileInput}
            id={fileId}
            type="file"
            accept=".csv,text/csv,text/comma-separated-values"
            multiple
            className={styles.fileInput}
            onChange={(event) => setFiles([...(event.target.files ?? [])])}
          />
        </label>

        <button
          type="button"
          className={styles.linkButton}
          aria-expanded={pasting}
          aria-controls={pasteId}
          onClick={() => setPasting((p) => !p)}
        >
          {pasting ? 'Ocultar' : '¿No te deja adjuntar? Pega el contenido'}
        </button>
        {pasting && (
          <textarea
            id={pasteId}
            aria-label="Contenido de los CSV"
            name="csv"
            autoComplete="off"
            spellCheck={false}
            className={styles.textarea}
            rows={6}
            value={pasted}
            placeholder={'"Nombre","Fecha","Formato","Posicion",…'}
            onChange={(event) => setPasted(event.target.value)}
          />
        )}

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" busy={importer.isPending}>
          {importer.isPending ? 'Importando…' : 'Importar'}
        </Button>
      </form>
      {importer.data && <ImportSummary summary={importer.data} />}
    </section>
  );
}

function ImportSummary({ summary }: { summary: LegacyImportResponse }) {
  const { imported, duplicates, linked, rejected } = summary;
  return (
    <div role="status" className={styles.summary}>
      <p>
        {imported === 0
          ? 'No había resultados nuevos.'
          : `Guardamos ${imported} ${imported === 1 ? 'resultado' : 'resultados'}.`}
        {linked > 0 &&
          ` ${linked} ${linked === 1 ? 'quedó ligado' : 'quedaron ligados'} a jugadores del equipo por su nombre.`}
        {duplicates > 0 && ` ${duplicates} ya ${duplicates === 1 ? 'estaba' : 'estaban'}.`}
      </p>
      {rejected.length > 0 && (
        <>
          <p className={styles.error}>
            {rejected.length === 1
              ? 'Una fila no se pudo leer:'
              : `${rejected.length} filas no se pudieron leer:`}
          </p>
          <ul className={styles.rejected}>
            {rejected.slice(0, 10).map((r) => (
              <li key={r.line}>
                Línea {r.line}: {r.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function LegacyList({ teamId }: { teamId: string }) {
  const legacy = useLegacyResults(teamId);
  if (!legacy.data || legacy.data.length === 0) return null;
  return (
    <section aria-labelledby="importados" className={styles.section}>
      <h2 id="importados" className={styles.sectionTitle}>
        Del prototipo ({legacy.data.length})
      </h2>
      <ul className={styles.list}>
        {legacy.data.map((r) => (
          <li key={r.id}>
            <div className={styles.listHead}>
              <span className={styles.listName}>{r.player?.displayName ?? r.playerName}</span>
              <span className={styles.listPos}>{POSITIONS[r.winner].name}</span>
            </div>
            <p className={styles.muted}>
              {[
                r.takenAt && TAKEN_ON.format(new Date(r.takenAt)),
                r.podium.length > 1 && r.podium.map((pos) => POSITIONS[pos].name).join(', '),
                r.prepScore !== null && `preparación ${r.prepScore}/${r.prepTotal}`,
                !r.player && 'sin ligar a un jugador',
              ]
                .filter(Boolean)
                .join('. ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
