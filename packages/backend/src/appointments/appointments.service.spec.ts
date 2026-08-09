import { AppointmentsService } from './appointments.service';

const TENANT_ID = 'tenant-1';

function buildPrisma(
  overrides: Partial<{
    timezone: string;
    appointments: unknown[];
    appointment: Record<string, unknown> | null;
  }> = {},
) {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        timezone: overrides.timezone ?? 'America/Mexico_City',
      }),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue(overrides.appointments ?? []),
      findFirst: jest.fn().mockResolvedValue(overrides.appointment ?? null),
      update: jest
        .fn()
        .mockResolvedValue({ id: 'appt-1', status: 'CANCELLED' }),
    },
  };
}

function buildEmail() {
  return {
    sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AppointmentsService calendar reads (tenant timezone)', () => {
  it('findByDate queries the tenant-TZ day bounds (Tijuana)', async () => {
    const prisma = buildPrisma({ timezone: 'America/Tijuana' });
    const service = new AppointmentsService(
      prisma as never,
      buildEmail() as never,
    );

    await service.findByDate(TENANT_ID, '2026-07-03');

    // Tijuana is UTC-7 in July: the day spans 07:00Z → next 07:00Z
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          startTime: {
            gte: new Date('2026-07-03T07:00:00.000Z'),
            lt: new Date('2026-07-04T07:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('findByWeek queries the tenant-TZ week bounds (Tijuana)', async () => {
    const prisma = buildPrisma({ timezone: 'America/Tijuana' });
    const service = new AppointmentsService(
      prisma as never,
      buildEmail() as never,
    );

    await service.findByWeek(TENANT_ID, '2026-06-29');

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          startTime: {
            gte: new Date('2026-06-29T07:00:00.000Z'),
            lt: new Date('2026-07-06T07:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('findByMonth groups appointments by the tenant-TZ calendar day near midnight', async () => {
    // 2026-07-04T06:30Z = 23:30 July 3 in Tijuana but 00:30 July 4 in CDMX
    const prisma = buildPrisma({
      timezone: 'America/Tijuana',
      appointments: [
        {
          id: 'a1',
          startTime: new Date('2026-07-04T06:30:00.000Z'),
          status: 'CONFIRMED',
          employee: { id: 'emp-1', name: 'María' },
        },
      ],
    });
    const service = new AppointmentsService(
      prisma as never,
      buildEmail() as never,
    );

    const density = await service.findByMonth(TENANT_ID, 2026, 7);

    expect(density['2026-07-03']).toEqual({ count: 1, employees: ['María'] });
    expect(density['2026-07-04']).toBeUndefined();
    // Month bounds are Tijuana wall-clock July
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startTime: {
            gte: new Date('2026-07-01T07:00:00.000Z'),
            lt: new Date('2026-08-01T07:00:00.000Z'),
          },
        }),
      }),
    );
  });
});

describe('AppointmentsService.updateStatus cancellation email (tenant timezone)', () => {
  it('formats the cancellation email date and time in the tenant timezone', async () => {
    // 15:00Z = 10:00 in Cancun (UTC-5); in CDMX it would render 09:00
    const prisma = buildPrisma({
      appointment: {
        id: 'appt-1',
        clientName: 'Ana',
        clientEmail: 'ana@example.com',
        startTime: new Date('2030-06-10T15:00:00.000Z'),
        employee: { name: 'María' },
        service: { name: 'Corte' },
        tenant: { name: 'Salón', slug: 'salon', timezone: 'America/Cancun' },
      },
    });
    const email = buildEmail();
    const service = new AppointmentsService(prisma as never, email as never);

    await service.updateStatus(TENANT_ID, 'appt-1', 'CANCELLED', 'motivo');

    expect(email.sendBookingCancellation).toHaveBeenCalledWith(
      expect.objectContaining({
        time: expect.stringMatching(/10:00/),
        date: expect.stringContaining('junio'),
      }),
    );
  });
});
