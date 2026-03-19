import { IsArray, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DaySchedule {
  @IsString()
  dayOfWeek: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime debe tener formato HH:mm' })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime debe tener formato HH:mm' })
  endTime: string;
}

export class BulkScheduleDto {
  @IsString()
  employeeId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DaySchedule)
  days: DaySchedule[];
}
