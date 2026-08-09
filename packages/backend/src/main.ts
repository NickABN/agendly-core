// Sentry debe instrumentar ANTES de cargar cualquier módulo de la app.
import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { join } from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildCorsAllowlist } from './config/cors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Preserva el body crudo para verificar la firma del webhook de Stripe
    rawBody: true,
  });

  // Logger estructurado (pino) para toda la app
  app.useLogger(app.get(Logger));

  // Detrás de Render/proxy: confía en X-Forwarded-For para obtener la IP real
  // del cliente (evidencia de consentimiento LFPDPPP, rate limiting por IP).
  app.set('trust proxy', 1);

  app.use(cookieParser());

  // Cabeceras de seguridad. El backend es API-only (no sirve HTML propio salvo
  // el mount legacy /uploads), así que los defaults de helmet no rompen nada.
  app.use(helmet());

  // Allowlist: admin frontend (FRONTEND_URL) + public booking site
  // (PUBLIC_APP_URL) — the booking pages call /availability/* and
  // /public/:slug from the browser and may live on a different origin.
  app.enableCors({
    origin: buildCorsAllowlist(process.env),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // DEPRECADO: solo sirve logos legacy subidos a disco antes de migrar a R2.
  // Los uploads nuevos van a R2 (URL absoluta). Quitar cuando no queden
  // registros con logoUrl relativo /uploads/... en la base.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
