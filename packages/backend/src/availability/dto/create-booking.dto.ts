import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AppointmentChannel } from '@agendly/shared';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  /** UTC ISO-8601 instant. The offset is mandatory — zoneless strings are rejected. */
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:?\d{2})$/, {
    message:
      'startTime debe ser un instante ISO-8601 con zona horaria (terminado en Z u offset)',
  })
  startTime: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre es demasiado corto' })
  @MaxLength(100)
  clientName: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^\+?[\d\s()-]{8,20}$/, { message: 'El teléfono no es válido' })
  clientPhone: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsEmail({}, { message: 'El correo no es válido' })
  clientEmail?: string;

  @IsOptional()
  @IsEnum(AppointmentChannel)
  channel?: AppointmentChannel;

  /** Time the client spent on the public form, in ms (friction metric; ≤ 1 h). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  bookingDurationMs?: number;
}
