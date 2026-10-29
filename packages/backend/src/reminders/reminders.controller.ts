import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { RemindersService } from './reminders.service';
import { assertCronSecret } from '../common/cron-secret';

export { secretsMatch } from '../common/cron-secret';

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
    assertCronSecret(this.config.get<string>('CRON_SECRET'), provided);
    return this.reminders.sendDueReminders();
  }
}
