import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ErrorBody } from '@sdl/contracts';
import type { FastifyReply } from 'fastify';

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'BUSINESS_RULE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Traduce cualquier error al formato común de docs/05-api.md. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body: ErrorBody = {
        error: {
          code: CODE_BY_STATUS[status] ?? 'HTTP_ERROR',
          message: exception.message,
        },
      };
      void reply.status(status).send(body);
      return;
    }

    this.logger.error(exception);
    const body: ErrorBody = { error: { code: 'INTERNAL', message: 'Error interno' } };
    void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(body);
  }
}
