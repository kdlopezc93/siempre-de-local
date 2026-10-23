import { BusinessRuleError } from '../errors/application-errors.js';

/** El cuerpo de una subida de foto: bytes (ver el parser de app.factory), o un 422 claro. */
export function photoBody(body: unknown): Buffer {
  if (!Buffer.isBuffer(body)) {
    throw new BusinessRuleError(
      'Manda la foto como imagen WebP o JPEG (Content-Type: image/webp o image/jpeg).',
      'PHOTO_INVALID',
    );
  }
  return body;
}
