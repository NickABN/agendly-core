import {
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /public/:slug — returns tenant info, services, and employees */
  @Get(':slug')
  async getTenantBySlug(@Param('slug') slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant || !tenant.isActive) {
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
