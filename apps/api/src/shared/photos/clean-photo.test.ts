import { describe, expect, it } from 'vitest';

import { cleanPhoto, MAX_PHOTO_BYTES } from './clean-photo.js';

function chunk(fourcc: string, data: Buffer) {
  const header = Buffer.alloc(8);
  header.write(fourcc, 0, 'ascii');
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}
function webp(...chunks: Buffer[]) {
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}
const GPS = Buffer.from('GPS 4.6097 -74.0817');

describe('limpiar fotos', () => {
  it('WebP: quita EXIF y XMP, y apaga sus banderas en VP8X', () => {
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x08 | 0x04 | 0x10; // EXIF, XMP y alfa
    const input = webp(
      chunk('VP8X', vp8x),
      chunk('VP8 ', Buffer.from('imagen')),
      chunk('EXIF', GPS),
      chunk('XMP ', Buffer.from('<x/>')),
    );
    const out = cleanPhoto(input)!;
    expect(out.contentType).toBe('image/webp');
    expect(out.bytes.includes(GPS)).toBe(false);
    expect(out.bytes.includes(Buffer.from('<x/>'))).toBe(false);
    expect(out.bytes.includes(Buffer.from('imagen'))).toBe(true);
    // Sigue siendo un RIFF válido, con su tamaño bien puesto.
    expect(out.bytes.readUInt32LE(4)).toBe(out.bytes.length - 8);
    expect(out.bytes[20]).toBe(0x10);
  });

  it('JPEG: quita APP1 (EXIF), APP13 y comentarios; deja el resto y la imagen', () => {
    const seg = (marker: number, data: Buffer) => {
      const h = Buffer.from([0xff, marker, 0, 0]);
      h.writeUInt16BE(data.length + 2, 2);
      return Buffer.concat([h, data]);
    };
    const input = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      seg(0xe0, Buffer.from('JFIF\0')),
      seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), GPS])),
      seg(0xfe, Buffer.from('comentario')),
      seg(0xdb, Buffer.from('tabla')),
      Buffer.from([0xff, 0xda, 0x00, 0x02]),
      Buffer.from('datos de la imagen'),
      Buffer.from([0xff, 0xd9]),
    ]);
    const out = cleanPhoto(input)!;
    expect(out.contentType).toBe('image/jpeg');
    expect(out.bytes.includes(GPS)).toBe(false);
    expect(out.bytes.includes(Buffer.from('comentario'))).toBe(false);
    expect(out.bytes.includes(Buffer.from('JFIF'))).toBe(true);
    expect(out.bytes.includes(Buffer.from('datos de la imagen'))).toBe(true);
  });

  it('rechaza lo que no es WebP ni JPEG, lo roto y lo muy grande', () => {
    expect(cleanPhoto(Buffer.from('<svg/>'))).toBeNull();
    expect(cleanPhoto(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(cleanPhoto(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]))).toBeNull();
    expect(cleanPhoto(Buffer.alloc(MAX_PHOTO_BYTES + 1))).toBeNull();
  });
});
