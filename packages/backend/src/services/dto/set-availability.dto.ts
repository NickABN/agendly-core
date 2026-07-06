import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DayOfWeek } from '@agendly/shared';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ServiceAvailabilityItemDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsOptional()
  @Matches(HH_MM, { message: 'startTime debe tener formato HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(HH_MM, { message: 'endTime debe tener formato HH:mm' })
  endTime?: string;
}

export class SetServiceAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAvailabilityItemDto)
  items: ServiceAvailabilityItemDto[];
}
