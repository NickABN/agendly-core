import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PublicDirectoryResponse,
  PublicTenantResponse,
} from '@agendly/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasActiveAccess,
  isBillingEnforced,
} from '../common/subscription-access';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns opted-in, publicly bookable businesses without exposing private tenant data. */
  async getDirectory(q?: string): Promise<PublicDirectoryResponse> {
    const query = q?.trim();
    const where: Prisma.TenantWhereInput = {
      listedInDirectory: true,
      onboardedAt: { not: null },
      deletionScheduledAt: null,
      isActive: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { address: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (isBillingEnforced()) {
      where.AND = [
        {
          OR: [
            { subscriptionStatus: { in: ['ACTIVE', 'PAST_DUE'] } },
            {
              subscriptionStatus: 'TRIALING',
              trialEndsAt: { gt: new Date() },
            },
          ],
        },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        isActive: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return {
      businesses: tenants
        .filter((tenant) => hasActiveAccess(tenant))
        .map((tenant) => ({
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl ?? null,
          address: tenant.address ?? null,
        })),
    };
  }

  /** Public landing data for the frontend public app /[slug] route. */
  async getTenantBySlug(slug: string): Promise<PublicTenantResponse> {
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
        logoUrl: tenant.logoUrl ?? null,
        bannerUrl: tenant.bannerUrl ?? null,
        address: tenant.address ?? null,
        phone: tenant.phone ?? null,
        ...(tenant.latitude !== undefined && {
          latitude: tenant.latitude === null ? null : Number(tenant.latitude),
        }),
        ...(tenant.longitude !== undefined && {
          longitude:
            tenant.longitude === null ? null : Number(tenant.longitude),
        }),
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
