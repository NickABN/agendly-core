import { IsNotEmpty, IsString, Matches } from 'class-validator';

/** Query params for GET /availability/slots (public). */
export class CheckAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;

  /** Employee id, or "any" to search across every active employee offering the service. */
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  /** Business-TZ calendar day. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD',
  })
  date: string;
}
