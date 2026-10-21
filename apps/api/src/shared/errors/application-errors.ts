/**
 * Errores que lanzan los casos de uso sin depender de HTTP. HttpExceptionFilter los
 * traduce al formato común (docs/05-api.md · Convenciones) usando `code`.
 */
export abstract class ApplicationError extends Error {
  abstract readonly status: number;

  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApplicationError {
  override readonly name = 'NotFoundError';
  readonly status = 404;

  constructor(message: string, code = 'NOT_FOUND') {
    super(message, code);
  }
}

export class ForbiddenError extends ApplicationError {
  override readonly name = 'ForbiddenError';
  readonly status = 403;

  constructor(message: string, code = 'FORBIDDEN') {
    super(message, code);
  }
}

/** Regla de negocio incumplida (422), con un código propio, p. ej. INVITATION_EXPIRED. */
export class BusinessRuleError extends ApplicationError {
  override readonly name = 'BusinessRuleError';
  readonly status = 422;
}
