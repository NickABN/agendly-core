import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

enum AppointmentChannel {
  WEB = 'WEB',
  MANUAL = 'MANUAL',
  WHATSAPP = 'WHATSAPP',
}

export class CreateBookingDto {
  @IsString()
  employeeId: string;

  @IsString()
  serviceId: string;

  @IsDateString()
  startTime: string; // ISO 8601

  @IsString()
  @MaxLength(100)
  clientName: string;

  @IsString()
  @MaxLength(20)
  clientPhone: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsEnum(AppointmentChannel)
  channel?: AppointmentChannel;
}
