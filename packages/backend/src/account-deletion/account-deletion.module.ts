import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ProfileModule } from '../profile/profile.module';
import {
  AccountDeletionController,
  AccountPurgeController,
} from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [BillingModule, ProfileModule],
  controllers: [AccountDeletionController, AccountPurgeController],
  providers: [AccountDeletionService],
})
export class AccountDeletionModule {}
