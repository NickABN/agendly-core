import * as Sentry from '@sentry/nestjs';

// Debe importarse ANTES que cualquier otro módulo (ver main.ts) para que
// la instrumentación de Sentry envuelva a Nest/Express/Prisma.
// Sin SENTRY_DSN queda en no-op (dev/PoC sin cuenta configurada).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Solo error tracking en el PoC (sin performance tracing → sin costo extra).
    tracesSampleRate: 0,
  });
}
