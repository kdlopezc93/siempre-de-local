import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';

import { canShareFiles, whatsappUrl } from '../share';
import styles from './Button.module.css';
import { Button } from './Button';

/**
 * "Mandar al grupo" (2026-11-06): abre WhatsApp con el mensaje listo para elegir el grupo del
 * equipo. Con `file` (la imagen de la alineación) y un celular que deja compartir archivos, usa
 * su menú de compartir: WhatsApp no recibe imágenes por enlace.
 */
export function GroupShare({
  message,
  file,
  label: text = 'Mandar al grupo',
}: {
  message: string;
  file?: File | null;
  /** Qué manda, si en la pantalla hay más de una cosa: "Mandar la alineación al grupo". */
  label?: string;
}) {
  const label = (
    <>
      <PaperPlaneTilt size={20} weight="bold" aria-hidden="true" />
      {text}
    </>
  );
  if (file && canShareFiles([file])) {
    return (
      <Button
        onClick={() => void navigator.share({ files: [file], text: message }).catch(() => {})}
      >
        {label}
      </Button>
    );
  }
  return (
    <a
      className={[styles.button, styles.link, styles.primary].join(' ')}
      href={whatsappUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}
