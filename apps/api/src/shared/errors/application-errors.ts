/**
 * Errores que lanzan los casos de uso sin depender de HTTP. HttpExceptionFilter los
 * traduce al formato común (docs/05-api.md · Convenciones).
 */
export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
}

export class ForbiddenError extends Error {
  override readonly name = 'ForbiddenError';
}
