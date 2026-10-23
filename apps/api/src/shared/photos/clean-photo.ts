/**
 * Limpia una foto subida antes de guardarla: solo WebP o JPEG, y **sin metadatos** (EXIF, con
 * la ubicación GPS de la cámara; XMP; IPTC; comentarios). El celular ya la manda recortada y
 * vuelta a codificar (sin metadatos); esto es la segunda barrera por si alguien la sube por
 * fuera de la app. No decodifica la imagen: recorre sus bloques y deja fuera los de metadatos.
 */
export interface CleanPhoto {
  bytes: Buffer;
  contentType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
}

export const MAX_PHOTO_BYTES = 512 * 1024;

export function cleanPhoto(input: Buffer): CleanPhoto | null {
  if (input.length === 0 || input.length > MAX_PHOTO_BYTES) return null;
  if (isWebp(input)) {
    const bytes = stripWebp(input);
    return bytes ? { bytes, contentType: 'image/webp', extension: 'webp' } : null;
  }
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) {
    const bytes = stripJpeg(input);
    return bytes ? { bytes, contentType: 'image/jpeg', extension: 'jpg' } : null;
  }
  return null;
}

const isWebp = (b: Buffer) =>
  b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';

/** Bloques de WebP que son metadatos. */
const WEBP_METADATA = new Set(['EXIF', 'XMP ']);
/** En el encabezado extendido (VP8X), los bits que anuncian EXIF (0x08) y XMP (0x04). */
const VP8X_METADATA_FLAGS = 0x08 | 0x04;

function stripWebp(input: Buffer): Buffer | null {
  const kept: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= input.length) {
    const fourcc = input.toString('ascii', offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > input.length + (size % 2)) return null;
    if (!WEBP_METADATA.has(fourcc)) {
      const chunk = Buffer.from(input.subarray(offset, Math.min(end, input.length)));
      if (fourcc === 'VP8X' && chunk.length > 8) chunk[8] = chunk[8]! & ~VP8X_METADATA_FLAGS;
      kept.push(chunk);
    }
    offset = end;
  }
  if (kept.length === 0) return null;
  const body = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

/** Segmentos de JPEG que son metadatos: APP1 (EXIF y XMP), APP13 (IPTC) y comentarios. */
const JPEG_METADATA = new Set([0xe1, 0xed, 0xfe]);

function stripJpeg(input: Buffer): Buffer | null {
  const kept: Buffer[] = [input.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) return null;
    const marker = input[offset + 1]!;
    // Desde el inicio de los datos de la imagen (SOS) va todo tal cual.
    if (marker === 0xda) {
      kept.push(input.subarray(offset));
      return Buffer.concat(kept);
    }
    const length = input.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > input.length) return null;
    if (!JPEG_METADATA.has(marker)) kept.push(input.subarray(offset, end));
    offset = end;
  }
  return null;
}
