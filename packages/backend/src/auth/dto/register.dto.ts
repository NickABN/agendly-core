import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** Aceptación expresa de Términos y Aviso de Privacidad (clickwrap). */
  @Equals(true, {
    message: 'Debes aceptar los Términos y el Aviso de Privacidad',
  })
  acceptedTerms!: true;
}
