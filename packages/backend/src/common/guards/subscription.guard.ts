import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { hasActiveAccess } from '../subscription-access';

/**
 * Bloquea rutas de mutación del admin cuando el tenant no tiene acceso vigente
 * (ver `hasActiveAccess`; sin `BILLING_ENFORCED=true` solo exige `isActive`).
 * NO se aplica a /billing (para que un tenant vencido pueda entrar a pagar) ni a
 * /auth ni a lecturas de perfil.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) return false;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        isActive: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    });
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('Cuenta desactivada');
    }

    if (!hasActiveAccess(tenant)) {
      throw new ForbiddenException(
        'Tu período de prueba terminó. Suscríbete para continuar.',
      );
    }
    return true;
  }
}
