/**
 * Errores que lanzan los casos de uso sin depender de HTTP. HttpExceptionFilter los
 * traduce al formato común (docs/05-api.md · Convenciones) usando `code`.
 */
export abstract class ApplicationError extends Error {
  abstract readonly status: number;
  /** Datos para que el cliente actúe, p. ej. `{ nextAttemptAt }`. Van en `error.details`. */
  details?: Record<string, unknown>;

  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }

  with(details: Record<string, unknown>): this {
    this.details = details;
    return this;
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

/** Choca con el estado actual (409), p. ej. EXAM_IN_PROGRESS. */
export class ConflictError extends ApplicationError {
  override readonly name = 'ConflictError';
  readonly status = 409;
}
