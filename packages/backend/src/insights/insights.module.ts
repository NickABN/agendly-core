import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { NoShowRiskService } from './no-show-risk.service';

@Module({
  controllers: [InsightsController],
  providers: [InsightsService, NoShowRiskService],
  exports: [NoShowRiskService],
})
export class InsightsModule {}
