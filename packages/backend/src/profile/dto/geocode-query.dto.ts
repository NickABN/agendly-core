import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GeocodeQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  q: string;
}
