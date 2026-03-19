import { IsDateString, IsString } from 'class-validator';

export class CheckAvailabilityDto {
  @IsString()
  employeeId: string;

  @IsString()
  serviceId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD
}
