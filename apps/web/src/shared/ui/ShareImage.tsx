import { ShareNetwork } from '@phosphor-icons/react/dist/csr/ShareNetwork';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { POSTER_VERSION } from '../poster/poster';
import { canShareFiles } from '../share';
import buttonStyles from './Button.module.css';
import { Button } from './Button';

/**
 * Compartir un afiche (2026-11-06: tu tarjeta, tu podio) con el menú del celular: el estado de
 * WhatsApp o un chat. La imagen se arma de antemano, porque el menú solo abre en el mismo toque.
 * Sin menú de compartir (el computador), el botón la descarga.
 */
export function ShareImage({
  queryKey,
  draw,
  label = 'Compartir',
}: {
  /** Clave de la imagen: cambia cuando cambian los datos del afiche. */
  queryKey: readonly unknown[];
  draw: () => Promise<File | null>;
  label?: string;
}) {
  const image = useQuery({
    queryKey: ['poster', POSTER_VERSION, ...queryKey],
    queryFn: draw,
    staleTime: Infinity,
    structuralSharing: false,
    networkMode: 'always',
  });
  const file = image.data ?? null;
  // Sin menú de compartir: un enlace de descarga, que se libera al cambiar o salir.
  const href = useMemo(
    () => (file && !canShareFiles([file]) ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => void (href && URL.revokeObjectURL(href)), [href]);

  const content = (
    <>
      <ShareNetwork size={20} weight="bold" aria-hidden="true" />
      {label}
    </>
  );
  if (file && canShareFiles([file])) {
    return (
      <Button
        variant="secondary"
        onClick={() => void navigator.share({ files: [file] }).catch(() => {})}
      >
        {content}
      </Button>
    );
  }
  if (file && href) {
    return (
      <a
        className={[buttonStyles.button, buttonStyles.link, buttonStyles.secondary].join(' ')}
        href={href}
        download={file.name}
      >
        {content}
      </a>
    );
  }
  // Mientras se arma (o si el navegador no puede dibujar), nada.
  return null;
}
