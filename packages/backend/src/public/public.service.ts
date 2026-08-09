import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hasActiveAccess } from '../common/subscription-access';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public landing data for the frontend public app /[slug] route. */
  async getTenantBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant || !hasActiveAccess(tenant)) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const [services, employees] = await Promise.all([
      this.prisma.service.findMany({
        where: { tenantId: tenant.id, deletedAt: null, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { tenantId: tenant.id, deletedAt: null, isActive: true },
        include: { services: { select: { serviceId: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceMXN: String(s.priceMXN),
      })),
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        serviceIds: e.services.map((s) => s.serviceId),
      })),
    };
  }
}
