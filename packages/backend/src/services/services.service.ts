import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ensureExists } from '../common/prisma/ensure-exists';
import type { DayOfWeek } from '../generated/prisma/client.js';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const services = await this.prisma.service.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return services.map((s) => this.toDto(s));
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    const service = await this.prisma.service.create({
      data: {
        tenantId,
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        bufferMinutes: dto.bufferMinutes ?? 0,
        priceMXN: dto.priceMXN,
      },
    });

    return this.toDto(service);
  }

  async createMany(tenantId: string, dtos: CreateServiceDto[]) {
    const created = await this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.service.create({
          data: {
            tenantId,
            name: dto.name,
            durationMinutes: dto.durationMinutes,
            bufferMinutes: dto.bufferMinutes ?? 0,
            priceMXN: dto.priceMXN,
          },
        }),
      ),
    );
    return created.map((s) => this.toDto(s));
  }

  async update(tenantId: string, serviceId: string, dto: UpdateServiceDto) {
    await this.ensureExists(tenantId, serviceId);

    const service = await this.prisma.service.update({
      where: { id: serviceId },
      data: dto,
    });

    return this.toDto(service);
  }

  async remove(tenantId: string, serviceId: string) {
    await this.ensureExists(tenantId, serviceId);

    await this.prisma.service.update({
      where: { id: serviceId },
      data: { deletedAt: new Date() },
    });
  }

  async getAvailability(tenantId: string, serviceId: string) {
    await this.ensureExists(tenantId, serviceId);

    return this.prisma.serviceAvailability.findMany({
      where: { serviceId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setAvailability(
    tenantId: string,
    serviceId: string,
    items: Array<{ dayOfWeek: string; startTime?: string; endTime?: string }>,
  ) {
    await this.ensureExists(tenantId, serviceId);

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAvailability.deleteMany({ where: { serviceId } });

      if (items.length > 0) {
        await tx.serviceAvailability.createMany({
          data: items.map((item) => ({
            serviceId,
            dayOfWeek: item.dayOfWeek as DayOfWeek,
            startTime: item.startTime ?? null,
            endTime: item.endTime ?? null,
          })),
        });
      }
    });

    return this.getAvailability(tenantId, serviceId);
  }

  private async ensureExists(tenantId: string, serviceId: string) {
    return ensureExists(
      await this.prisma.service.findFirst({
        where: { id: serviceId, tenantId, deletedAt: null },
      }),
      'Servicio no encontrado',
    );
  }

  private toDto(service: {
    id: string;
    name: string;
    durationMinutes: number;
    bufferMinutes: number;
    priceMXN: unknown;
    isActive: boolean;
  }) {
    return {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      priceMXN: String(service.priceMXN),
      isActive: service.isActive,
    };
  }
}
