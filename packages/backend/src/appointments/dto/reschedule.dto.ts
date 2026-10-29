import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class RescheduleDto {
  /** UTC ISO-8601 instant. The offset is mandatory — zoneless strings are rejected. */
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:?\d{2})$/, {
    message:
      'startTime debe ser un instante ISO-8601 con zona horaria (terminado en Z u offset)',
  })
  startTime: string;

  /** Optional new employee; defaults to the current one. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  employeeId?: string;
}

export class RescheduleSlotsQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date debe ser YYYY-MM-DD' })
  date: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  employeeId?: string;
}
