/** Guarda un archivo en el dispositivo (descarga del navegador). */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Después del clic: algunos navegadores leen el blob en el siguiente ciclo.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
