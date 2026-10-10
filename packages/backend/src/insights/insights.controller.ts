import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { InsightsService } from './insights.service';
import { InsightsQueryDto } from './dto/insights-query.dto';

@Controller('insights')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('summary')
  summary(@CurrentTenant() tenantId: string, @Query() query: InsightsQueryDto) {
    return this.insights.summary(tenantId, query.from, query.to);
  }
}
