import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { assertCronSecret } from '../common/cron-secret';
import {
  AccountDeletionService,
  type SessionUser,
} from './account-deletion.service';
import { RequestDeletionDto } from './dto/request-deletion.dto';

/**
 * Owner self-service account deletion. Deliberately WITHOUT SubscriptionGuard:
 * a tenant pending deletion is inactive and must still be able to reactivate.
 */
@Controller('account/deletion')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AccountDeletionController {
  constructor(private readonly accountDeletion: AccountDeletionService) {}

  @Get()
  status(@CurrentUser() user: SessionUser) {
    return this.accountDeletion.status(user);
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  request(@CurrentUser() user: SessionUser, @Body() dto: RequestDeletionDto) {
    return this.accountDeletion.requestDeletion(
      user,
      dto.confirmSlug,
      dto.password,
    );
  }

  @Delete()
  cancel(@CurrentUser() user: SessionUser) {
    return this.accountDeletion.cancelDeletion(user);
  }
}

/** System job: called daily by GitHub Actions with CRON_SECRET. */
@Controller('account/purge')
export class AccountPurgeController {
  constructor(
    private readonly accountDeletion: AccountDeletionService,
    private readonly config: ConfigService,
  ) {}

  @Post('run')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  run(@Headers('x-cron-secret') provided?: string) {
    assertCronSecret(this.config.get<string>('CRON_SECRET'), provided);
    return this.accountDeletion.purgeDue();
  }
}
