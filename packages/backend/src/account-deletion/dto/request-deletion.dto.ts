import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestDeletionDto {
  @IsString()
  @IsNotEmpty({
    message: 'Escribe el identificador de tu negocio para confirmar',
  })
  @MaxLength(100)
  confirmSlug: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}
