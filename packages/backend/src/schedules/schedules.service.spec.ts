import { NotFoundException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';

/** Mock mínimo de Prisma para probar la verificación de ownership del empleado. */
function makePrisma(employeeFindFirst: jest.Mock) {
  return {
    employee: { findFirst: employeeFindFirst },
    schedule: {
      upsert: jest.fn().mockResolvedValue({
        id: 's1',
        employeeId: 'emp-1',
        dayOfWeek: 'MONDAY',
        blockIndex: 0,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
      typeof cb === 'function'
        ? cb({
            schedule: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          })
        : Promise.resolve([]),
    ),
  } as never;
}

describe('SchedulesService — tenant isolation (OWASP A01/IDOR)', () => {
  const TENANT = 'tenant-a';
  const dto = {
    employeeId: 'emp-de-otro-tenant',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '18:00',
  };

  it('create rejects an employeeId that does not belong to the tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null); // no existe en el tenant
    const service = new SchedulesService(makePrisma(findFirst));

    await expect(service.create(TENANT, dto as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: dto.employeeId, tenantId: TENANT, deletedAt: null },
    });
  });

  it('bulkSet rejects a foreign employeeId before touching schedules', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma(findFirst);
    const service = new SchedulesService(prisma);

    await expect(
      service.bulkSet(TENANT, {
        employeeId: dto.employeeId,
        days: [],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      (prisma as unknown as { $transaction: jest.Mock }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it('createDefault rejects a foreign employeeId', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new SchedulesService(makePrisma(findFirst));

    await expect(
      service.createDefault(TENANT, dto.employeeId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create proceeds when the employee belongs to the tenant', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'emp-1', tenantId: TENANT });
    const service = new SchedulesService(makePrisma(findFirst));

    const result = await service.create(TENANT, {
      ...dto,
      employeeId: 'emp-1',
    } as never);
    expect(result.employeeId).toBe('emp-1');
  });
});
