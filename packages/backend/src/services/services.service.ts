import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const services = await this.prisma.service.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return services.map(this.toDto);
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
    const results = [];
    for (const dto of dtos) {
      results.push(await this.create(tenantId, dto));
    }
    return results;
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

  private async ensureExists(tenantId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, tenantId, deletedAt: null },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
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
