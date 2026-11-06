/** wa.me abre WhatsApp (app o web) con el mensaje listo para elegir el chat del equipo. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** La dirección completa de una pantalla de la app, para pegarla en un mensaje. */
export const appUrl = (path: string) => `${window.location.origin}${path}`;

/** Si el celular deja compartir archivos (la imagen de la alineación) con su menú de compartir. */
export function canShareFiles(files: File[]): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files });
}
