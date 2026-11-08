import {
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizePhone } from '@agendly/shared';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  // Accept loose MX input and foreign numbers by normalizing to E.164 first,
  // then keep the broad E.164 validation. The lower bound stays at 1 digit to
  // preserve the existing E.164 property test in profile.service.spec.ts, which
  // is outside this change's allowed edit surfaces.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (normalizePhone(value) ?? value.trim()) : value,
  )
  @Matches(/^\+[1-9]\d{1,14}$/)
  phone?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
