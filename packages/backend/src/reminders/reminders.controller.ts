import {
  Controller,
  Headers,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'crypto';
import { RemindersService } from './reminders.service';

/** Constant-time comparison of two secrets of any length. */
export function secretsMatch(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * System job endpoint, called hourly by the GitHub Actions scheduler with the
 * shared `CRON_SECRET`. Not tenant-scoped: it processes every tenant.
 */
@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly config: ConfigService,
  ) {}

  @Post('run')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  run(@Headers('x-cron-secret') provided?: string) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected) {
      throw new ServiceUnavailableException('Recordatorios no configurados');
    }
    if (!provided || !secretsMatch(provided, expected)) {
      throw new UnauthorizedException();
    }
    return this.reminders.sendDueReminders();
  }
}
