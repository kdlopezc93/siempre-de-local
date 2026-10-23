import { useEffect, useId, useRef, useState } from 'react';

import { preparePhoto } from '../photos/prepare-photo';
import { Button } from './Button';
import styles from './PhotoPicker.module.css';
import { Token } from './Token';

/**
 * Elegir una foto (07 §4.7): se recorta al centro y se reduce en el celular, se ve cómo queda
 * en el disco y recién ahí se sube. También se puede quitar. Las fallas las muestra quien la usa
 * (`error`), salvo la de preparar la imagen.
 */
export function PhotoPicker({
  label,
  current,
  fallback,
  busy,
  error,
  onUpload,
  onRemove,
}: {
  label: string;
  current: string | null;
  /** Lo que se ve sin foto (iniciales o dorsal). */
  fallback: string;
  busy: boolean;
  error: string | null;
  onUpload: (photo: Blob, done: () => void) => void;
  onRemove: () => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [unreadable, setUnreadable] = useState(false);

  // Libera la vista previa al cambiarla o al salir.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function pick(file: File | undefined) {
    if (!file) return;
    setUnreadable(false);
    try {
      const blob = await preparePhoto(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setUnreadable(true);
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className={styles.picker}>
      <div className={styles.row}>
        {preview ? (
          <img src={preview.url} alt="Así queda tu foto" className={styles.preview} />
        ) : (
          <Token text={fallback} size="lg" photo={current} />
        )}
        <div className={styles.actions}>
          {preview ? (
            <>
              <Button busy={busy} onClick={() => onUpload(preview.blob, () => setPreview(null))}>
                Usar esta foto
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}>
                Elegir otra
              </Button>
            </>
          ) : (
            <>
              <label htmlFor={inputId} className={styles.choose}>
                {current ? 'Cambiar foto' : 'Subir foto'}
              </label>
              <input
                ref={input}
                id={inputId}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label={label}
                onChange={(e) => void pick(e.target.files?.[0])}
              />
              {current && (
                <button type="button" className={styles.remove} disabled={busy} onClick={onRemove}>
                  Quitar foto
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {(unreadable || error) && (
        <p role="alert" className={styles.error}>
          {unreadable ? 'No pudimos abrir esa imagen. Prueba con otra.' : error}
        </p>
      )}
    </div>
  );
}
