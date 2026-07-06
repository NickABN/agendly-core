import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Config de logging estructurado (pino) para nestjs-pino.
 * - JSON a stdout (Render lo ingesta); pino-pretty solo en dev.
 * - request-id por request (reusa x-request-id si viene, si no genera uno).
 * - redacción de headers sensibles (Authorization, Cookie).
 * - nivel desde LOG_LEVEL (default 'info').
 */
export function loggerConfig(): Params {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'info',
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const existing = req.headers['x-request-id'];
        const id =
          (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
        ],
        remove: true,
      },
      // Menos ruido: no loguear los health checks
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          req.url === '/health' || req.url === '/health/ready',
      },
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'HH:MM:ss' },
          },
    },
  };
}
