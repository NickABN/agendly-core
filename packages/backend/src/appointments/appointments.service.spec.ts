import { BadRequestException, ConflictException } from '@nestjs/common';
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

function buildRisk() {
  return { annotate: jest.fn().mockResolvedValue(new Map()) };
}

describe('AppointmentsService calendar reads (tenant timezone)', () => {
  it('findByDate queries the tenant-TZ day bounds (Tijuana)', async () => {
    const prisma = buildPrisma({ timezone: 'America/Tijuana' });
    const service = new AppointmentsService(
      prisma as never,
      buildEmail() as never,
      buildRisk() as never,
      null as never,
      null as never,
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
      buildRisk() as never,
      null as never,
      null as never,
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
      buildRisk() as never,
      null as never,
      null as never,
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
    const service = new AppointmentsService(
      prisma as never,
      email as never,
      buildRisk() as never,
      null as never,
      null as never,
    );

    await service.updateStatus(TENANT_ID, 'appt-1', 'CANCELLED', 'motivo');

    expect(email.sendBookingCancellation).toHaveBeenCalledWith(
      expect.objectContaining({
        time: expect.stringMatching(/10:00/),
        date: expect.stringContaining('junio'),
      }),
    );
  });
});

describe('AppointmentsService.reschedule', () => {
  const FUTURE_START = new Date('2030-06-10T15:00:00.000Z');
  const NEW_START = '2030-06-11T16:00:00.000Z';

  function setup(
    opts: {
      status?: string;
      slots?: Array<{ start: string; end: string }>;
      employee?: { id: string; name: string } | null;
      clientEmail?: string | null;
      updateError?: Error;
    } = {},
  ) {
    const appointment = {
      id: 'appt-1',
      tenantId: TENANT_ID,
      employeeId: 'emp-1',
      serviceId: 'svc-1',
      clientName: 'Ana',
      clientEmail:
        opts.clientEmail === undefined ? 'ana@example.com' : opts.clientEmail,
      status: opts.status ?? 'CONFIRMED',
      startTime: FUTURE_START,
      service: { name: 'Corte', durationMinutes: 45, bufferMinutes: 15 },
      tenant: { name: 'Salón', slug: 'salon', timezone: 'America/Cancun' },
    };
    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(appointment),
        update: opts.updateError
          ? jest.fn().mockRejectedValue(opts.updateError)
          : jest
              .fn()
              .mockImplementation(
                ({ data }: { data: Record<string, unknown> }) =>
                  Promise.resolve({ id: 'appt-1', ...data }),
              ),
      },
      employee: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            opts.employee === undefined
              ? { id: 'emp-1', name: 'María' }
              : opts.employee,
          ),
      },
    };
    const email = {
      sendBookingRescheduled: jest.fn().mockResolvedValue(undefined),
    };
    const availability = {
      getAvailableSlots: jest
        .fn()
        .mockResolvedValue(
          opts.slots ?? [{ start: NEW_START, end: '2030-06-11T16:45:00.000Z' }],
        ),
    };
    const links = {
      manageUrl: (id: string) => `https://app.test/cita/${id}.sig`,
    };
    const service = new AppointmentsService(
      prisma as never,
      email as never,
      buildRisk() as never,
      availability as never,
      links as never,
    );
    return { service, prisma, email, availability };
  }

  it('moves the appointment, resets the reminder and emails the client', async () => {
    const { service, prisma, email, availability } = setup();

    const res = await service.reschedule(TENANT_ID, 'appt-1', NEW_START);

    expect(availability.getAvailableSlots).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        serviceId: 'svc-1',
        date: '2030-06-11',
        timezone: 'America/Cancun',
        excludeAppointmentId: 'appt-1',
      }),
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        startTime: new Date(NEW_START),
        endTime: new Date('2030-06-11T16:45:00.000Z'),
        employeeId: 'emp-1',
        reminderSentAt: null,
      },
    });
    expect(res).toEqual({
      id: 'appt-1',
      employeeId: 'emp-1',
      startTime: NEW_START,
      endTime: '2030-06-11T16:45:00.000Z',
    });
    // 16:00Z = 11:00 in Cancun; previous 15:00Z = 10:00
    expect(email.sendBookingRescheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        time: expect.stringMatching(/11:00/),
        previousTime: expect.stringMatching(/10:00/),
        manageUrl: 'https://app.test/cita/appt-1.sig',
      }),
    );
  });

  it('can move the appointment to another employee who offers the service', async () => {
    const { service, prisma } = setup({
      employee: { id: 'emp-2', name: 'Luis' },
    });

    await service.reschedule(TENANT_ID, 'appt-1', NEW_START, 'emp-2');

    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'emp-2',
          tenantId: TENANT_ID,
          services: { some: { serviceId: 'svc-1' } },
        }),
      }),
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeId: 'emp-2' }),
      }),
    );
  });

  it('rejects a slot that is not currently available', async () => {
    const { service, prisma } = setup({ slots: [] });

    await expect(
      service.reschedule(TENANT_ID, 'appt-1', NEW_START),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('rejects appointments that are no longer confirmed', async () => {
    const { service } = setup({ status: 'CANCELLED' });

    await expect(
      service.reschedule(TENANT_ID, 'appt-1', NEW_START),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects past instants and employees who do not offer the service', async () => {
    await expect(
      setup().service.reschedule(
        TENANT_ID,
        'appt-1',
        '2020-01-01T15:00:00.000Z',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      setup({ employee: null }).service.reschedule(
        TENANT_ID,
        'appt-1',
        NEW_START,
        'emp-x',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps the DB anti-overlap violation to a conflict', async () => {
    const { service } = setup({
      updateError: new Error(
        'violates exclusion constraint "appointment_no_overlap"',
      ),
    });

    await expect(
      service.reschedule(TENANT_ID, 'appt-1', NEW_START),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not email clients without an address', async () => {
    const { service, email } = setup({ clientEmail: null });

    await service.reschedule(TENANT_ID, 'appt-1', NEW_START);

    expect(email.sendBookingRescheduled).not.toHaveBeenCalled();
  });
});
