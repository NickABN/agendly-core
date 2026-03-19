import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(5)
  durationMinutes: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceMXN: number;
}
