/** Lado del cuadrado que se sube: suficiente para la ficha más grande en pantallas densas. */
export const PHOTO_SIZE = 512;

/**
 * Prepara una foto en el celular antes de subirla (ADR-09): la endereza según la cámara, la
 * recorta al centro en cuadrado, la reduce a 512 px y la vuelve a codificar (WebP, o JPEG si
 * el navegador no codifica WebP). Al volver a codificar se pierden los metadatos, incluida la
 * ubicación GPS; el API igual los revisa.
 */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Sin canvas');
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  );
  bitmap.close();
  const webp = await toBlob(canvas, 'image/webp', 0.85);
  // Safari viejo devuelve PNG cuando no sabe codificar WebP.
  if (webp?.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!jpeg) throw new Error('No se pudo codificar la foto');
  return jpeg;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
