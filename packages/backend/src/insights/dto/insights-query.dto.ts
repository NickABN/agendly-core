import { IsOptional, Matches } from 'class-validator';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Optional `YYYY-MM-DD` range in the tenant timezone (default: last 30 days). */
export class InsightsQueryDto {
  @IsOptional()
  @Matches(DATE_KEY, { message: 'from debe tener formato AAAA-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE_KEY, { message: 'to debe tener formato AAAA-MM-DD' })
  to?: string;
}
