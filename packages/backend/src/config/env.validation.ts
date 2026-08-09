import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  NotEquals,
  validateSync,
} from 'class-validator';

/** Valor default local — jamás debe llegar a un entorno real (OWASP A05). */
const INSECURE_JWT_DEFAULT = 'dev-only-insecure-secret-change-me';
const LOCAL_FRONTEND_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

function isHostedRenderEnvironment(
  env: Pick<EnvironmentVariables, 'RENDER' | 'RENDER_SERVICE_ID'>,
): boolean {
  return (
    env.RENDER === 'true' ||
    (typeof env.RENDER_SERVICE_ID === 'string' && env.RENDER_SERVICE_ID !== '')
  );
}

function isLocalDockerCompose(env: EnvironmentVariables): boolean {
  return env.AGENDLY_LOCAL_DOCKER === 'true' && !isHostedRenderEnvironment(env);
}

function validateProductionFrontendUrl(
  name: 'FRONTEND_URL' | 'PUBLIC_APP_URL',
  value: unknown,
  allowLocalDockerCompose: boolean,
): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required when NODE_ENV=production`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL when NODE_ENV=production`);
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error(`${name} must use http or https when NODE_ENV=production`);
  }

  if (
    !allowLocalDockerCompose &&
    LOCAL_FRONTEND_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error(
      `${name} cannot point to localhost when NODE_ENV=production`,
    );
  }

  if (!allowLocalDockerCompose && url.protocol !== 'https:') {
    throw new Error(`${name} must use https when NODE_ENV=production`);
  }
}

class EnvironmentVariables {
  // Optional-when-unset (dev default), but a typo like 'Production' must fail
  // fast: prod-only checks and secure cookies key off the exact string.
  @IsIn(['development', 'production', 'test'], {
    message: 'NODE_ENV must be one of: development, production, test',
  })
  @IsOptional()
  NODE_ENV?: string;

  @IsString()
  @IsOptional()
  AGENDLY_LOCAL_DOCKER?: string;

  @IsString()
  @IsOptional()
  RENDER?: string;

  @IsString()
  @IsOptional()
  RENDER_SERVICE_ID?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32, {
    message:
      'JWT_SECRET debe tener al menos 32 caracteres (usa: openssl rand -hex 32)',
  })
  @NotEquals(INSECURE_JWT_DEFAULT, {
    message:
      'JWT_SECRET no puede ser el valor default inseguro; genera uno con openssl rand -hex 32',
  })
  JWT_SECRET!: string;

  // Sesión: access token corto + refresh token deslizante con tope absoluto.
  // Sin secreto nuevo — el refresh es opaco (random + SHA-256), no firmado.
  @IsString()
  @IsOptional()
  ACCESS_TOKEN_TTL?: string; // def 15m

  @IsString()
  @IsOptional()
  REFRESH_TOKEN_TTL?: string; // def 7d (deslizante)

  @IsString()
  @IsOptional()
  REFRESH_ABSOLUTE_TTL?: string; // def 30d (tope duro de la familia)

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  PUBLIC_APP_URL?: string;

  // Observabilidad (opcionales; sin ellas: log level 'info', Sentry no-op)
  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  // Stripe (opcionales; sin ellas los endpoints de billing responden 503)
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  STRIPE_PRICE_ID?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (validatedConfig.NODE_ENV === 'production') {
    validateProductionFrontendUrl(
      'FRONTEND_URL',
      validatedConfig.FRONTEND_URL,
      isLocalDockerCompose(validatedConfig),
    );
    validateProductionFrontendUrl(
      'PUBLIC_APP_URL',
      validatedConfig.PUBLIC_APP_URL,
      isLocalDockerCompose(validatedConfig),
    );
  }

  return validatedConfig;
}
