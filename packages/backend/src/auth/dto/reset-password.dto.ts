import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  // Same strength rule as register (see register.dto.ts).
  @IsString()
  @MinLength(8)
  password!: string;
}
