import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';

/**
 * Global safety net: HTTP exceptions pass through untouched; anything else is
 * logged con contexto (método, ruta, requestId), reportado a Sentry y devuelto
 * como un 500 sanitizado en español, sin filtrar internals al cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const err =
      exception instanceof Error ? exception : new Error(String(exception));

    // Contexto de request para correlación (sin cuerpo ni PII)
    this.logger.error(
      {
        err,
        method: request?.method,
        path: request?.url,
        requestId: request?.id,
      },
      err.stack,
    );

    // Reporte a Sentry (no-op si no hay DSN configurado)
    Sentry.captureException(err);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    });
  }
}
