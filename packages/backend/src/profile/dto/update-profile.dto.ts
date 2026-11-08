import {
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeMxPhone } from '@agendly/shared';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  // Accept loose MX input (10 digits, 52/+52 prefixes, legacy prefixes) by
  // normalizing to E.164 first, then keep the strict E.164 validation.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? (normalizeMxPhone(value) ?? value.trim())
      : value,
  )
  @Matches(/^\+[1-9]\d{1,14}$/)
  phone?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
