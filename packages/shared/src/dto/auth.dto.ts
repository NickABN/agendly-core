export interface RegisterDto {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  /** Owner explicitly accepted Términos y Condiciones + Aviso de Privacidad. */
  acceptedTerms: true;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}
