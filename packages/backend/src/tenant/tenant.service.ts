import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return this.toDto(tenant);
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    if (dto.slug) {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== tenantId) {
        throw new ConflictException('Este slug ya está en uso');
      }
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });

    return this.toDto(tenant);
  }

  async completeOnboarding(tenantId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardedAt: new Date() },
    });

    return this.toDto(tenant);
  }

  async updateLogoUrl(tenantId: string, logoUrl: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
    });

    return this.toDto(tenant);
  }

  private toDto(tenant: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    latitude: unknown;
    longitude: unknown;
    timezone: string;
    onboardedAt: Date | null;
    trialEndsAt: Date;
    isActive: boolean;
  }) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      phone: tenant.phone,
      address: tenant.address,
      logoUrl: tenant.logoUrl,
      latitude: tenant.latitude ? Number(tenant.latitude) : null,
      longitude: tenant.longitude ? Number(tenant.longitude) : null,
      timezone: tenant.timezone,
      onboardedAt: tenant.onboardedAt?.toISOString() ?? null,
      trialEndsAt: tenant.trialEndsAt.toISOString(),
      isActive: tenant.isActive,
    };
  }
}
