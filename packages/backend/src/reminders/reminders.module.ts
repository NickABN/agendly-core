import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [InsightsModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
