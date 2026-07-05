import type { Request } from 'express';

/** Payload que JwtStrategy adjunta a request.user tras validar el token. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

/** Request tipada para guards/decorators de rutas protegidas. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  /** Adjuntado por TenantGuard para acceso directo. */
  tenantId?: string;
}
