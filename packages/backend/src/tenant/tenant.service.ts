import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { mapTenantToProfileDto } from './tenant.mapper';
import type { Tenant } from '../generated/prisma/client.js';

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

  private toDto(tenant: Tenant) {
    return mapTenantToProfileDto(tenant);
  }
}
