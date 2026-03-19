import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      include: { services: { select: { serviceId: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      isActive: e.isActive,
      serviceIds: e.services.map((s) => s.serviceId),
    }));
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        name: dto.name,
        services: dto.serviceIds?.length
          ? {
              create: dto.serviceIds.map((serviceId) => ({ serviceId })),
            }
          : undefined,
      },
      include: { services: { select: { serviceId: true } } },
    });

    return {
      id: employee.id,
      name: employee.name,
      isActive: employee.isActive,
      serviceIds: employee.services.map((s) => s.serviceId),
    };
  }

  async createMany(tenantId: string, dtos: CreateEmployeeDto[]) {
    const results = [];
    for (const dto of dtos) {
      results.push(await this.create(tenantId, dto));
    }
    return results;
  }

  async update(tenantId: string, employeeId: string, dto: UpdateEmployeeDto) {
    await this.ensureExists(tenantId, employeeId);

    // Update service associations if provided
    if (dto.serviceIds !== undefined) {
      await this.prisma.employeeService.deleteMany({
        where: { employeeId },
      });
      if (dto.serviceIds.length > 0) {
        await this.prisma.employeeService.createMany({
          data: dto.serviceIds.map((serviceId) => ({
            employeeId,
            serviceId,
          })),
        });
      }
    }

    const employee = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { services: { select: { serviceId: true } } },
    });

    return {
      id: employee.id,
      name: employee.name,
      isActive: employee.isActive,
      serviceIds: employee.services.map((s) => s.serviceId),
    };
  }

  async remove(tenantId: string, employeeId: string) {
    await this.ensureExists(tenantId, employeeId);

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { deletedAt: new Date() },
    });
  }

  private async ensureExists(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    return employee;
  }
}
