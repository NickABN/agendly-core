import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  NotEquals,
  validateSync,
} from 'class-validator';

/** Valor default local — jamás debe llegar a un entorno real (OWASP A05). */
const INSECURE_JWT_DEFAULT = 'dev-only-insecure-secret-change-me';

class EnvironmentVariables {
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

  @IsString()
  @IsOptional()
  JWT_EXPIRATION?: string;

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
  return validatedConfig;
}
