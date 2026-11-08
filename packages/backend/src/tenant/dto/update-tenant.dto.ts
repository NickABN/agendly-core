import {
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizePhone } from '@agendly/shared';

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
  // a present value is normalized to E.164 (MX or foreign) and rejected if it is
  // not a valid phone number.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    // null (not undefined) so Prisma actually clears the stored phone.
    if (trimmed === '') return null;
    return normalizePhone(trimmed) ?? trimmed;
  })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'El teléfono no es válido' })
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
