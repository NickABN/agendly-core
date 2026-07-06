import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ensureExists } from '../common/prisma/ensure-exists';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica que todos los serviceIds pertenezcan al tenant antes de asociarlos.
   * Evita que un tenant vincule su empleado a un servicio ajeno (OWASP A01).
   */
  private async assertServicesInTenant(
    tenantId: string,
    serviceIds: string[],
  ): Promise<void> {
    if (serviceIds.length === 0) return;
    const unique = [...new Set(serviceIds)];
    const count = await this.prisma.service.count({
      where: { id: { in: unique }, tenantId, deletedAt: null },
    });
    if (count !== unique.length) {
      throw new BadRequestException(
        'Uno o más servicios no pertenecen a tu negocio',
      );
    }
  }

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
    await this.assertServicesInTenant(tenantId, dto.serviceIds ?? []);
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
    await this.assertServicesInTenant(
      tenantId,
      dtos.flatMap((d) => d.serviceIds ?? []),
    );
    const created = await this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.employee.create({
          data: {
            tenantId,
            name: dto.name,
            services: dto.serviceIds?.length
              ? { create: dto.serviceIds.map((serviceId) => ({ serviceId })) }
              : undefined,
          },
          include: { services: { select: { serviceId: true } } },
        }),
      ),
    );
    return created.map((employee) => ({
      id: employee.id,
      name: employee.name,
      isActive: employee.isActive,
      serviceIds: employee.services.map((s) => s.serviceId),
    }));
  }

  async update(tenantId: string, employeeId: string, dto: UpdateEmployeeDto) {
    await this.ensureExists(tenantId, employeeId);

    // Update service associations if provided
    if (dto.serviceIds !== undefined) {
      await this.assertServicesInTenant(tenantId, dto.serviceIds);
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
    return ensureExists(
      await this.prisma.employee.findFirst({
        where: { id: employeeId, tenantId, deletedAt: null },
      }),
      'Empleado no encontrado',
    );
  }
}
