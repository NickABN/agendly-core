import {
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeMxPhone } from '@agendly/shared';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones',
  })
  @MaxLength(60)
  slug?: string;

  // Optional business phone. An empty value clears it (stored as null); an absent one leaves it unchanged;
  // a present value is normalized to E.164 and rejected if it is not a valid
  // Mexican number.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    // null (not undefined) so Prisma actually clears the stored phone.
    if (trimmed === '') return null;
    return normalizeMxPhone(trimmed) ?? trimmed;
  })
  @IsString()
  @Matches(/^\+52\d{10}$/, { message: 'El teléfono no es válido' })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsTimeZone({
    message: 'La zona horaria debe ser un identificador IANA válido',
  })
  timezone?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
