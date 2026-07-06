import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de Render/proxy: confía en X-Forwarded-For para obtener la IP real
  // del cliente (evidencia de consentimiento LFPDPPP, rate limiting por IP).
  app.set('trust proxy', 1);

  // Cabeceras de seguridad. El backend es API-only (no sirve HTML propio salvo
  // el mount legacy /uploads), así que los defaults de helmet no rompen nada.
  app.use(helmet());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
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
