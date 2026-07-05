import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class TrialGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.user?.tenantId;

    if (!tenantId) return false;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { trialEndsAt: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('Cuenta desactivada');
    }

    if (new Date() > tenant.trialEndsAt) {
      throw new ForbiddenException(
        'Tu período de prueba ha terminado. Actualiza tu plan para continuar.',
      );
    }

    return true;
  }
}
