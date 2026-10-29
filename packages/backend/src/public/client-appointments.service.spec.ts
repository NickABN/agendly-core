import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientAppointmentsService } from './client-appointments.service';

const NOW = new Date('2030-06-01T12:00:00.000Z');

function build(
  opts: {
    status?: string;
    startTime?: Date;
    updateCount?: number;
    valid?: boolean;
  } = {},
) {
  const appointment = {
    id: 'appt-1',
    clientName: 'Ana',
    clientPhone: '5512345678',
    status: opts.status ?? 'CONFIRMED',
    startTime: opts.startTime ?? new Date('2030-06-10T15:00:00.000Z'),
    endTime: new Date('2030-06-10T16:00:00.000Z'),
    employee: { name: 'María' },
    service: { name: 'Corte' },
    tenant: {
      id: 'tenant-1',
      name: 'Salón',
      slug: 'salon',
      timezone: 'America/Cancun',
      phone: null,
      address: null,
    },
  };
  const prisma = {
    appointment: {
      findUnique: jest.fn().mockResolvedValue(appointment),
      updateMany: jest.fn().mockResolvedValue({ count: opts.updateCount ?? 1 }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ email: 'owner@salon.mx' }),
    },
  };
  const email = {
    sendClientCancellationNotice: jest.fn().mockResolvedValue(undefined),
  };
  const links = {
    verify: jest.fn().mockReturnValue(opts.valid === false ? null : 'appt-1'),
  };
  const service = new ClientAppointmentsService(
    prisma as never,
    email as never,
    links as never,
  );
  return { service, prisma, email, links };
}

describe('ClientAppointmentsService', () => {
  it('shows a confirmed upcoming appointment as cancellable', async () => {
    const { service } = build();

    const dto = await service.findByToken('appt-1.sig', NOW);

    expect(dto).toEqual(
      expect.objectContaining({
        serviceName: 'Corte',
        employeeName: 'María',
        status: 'CONFIRMED',
        canCancel: true,
        startTime: '2030-06-10T15:00:00.000Z',
        business: expect.objectContaining({
          slug: 'salon',
          timezone: 'America/Cancun',
        }),
      }),
    );
  });

  it('is not cancellable once started or no longer confirmed', async () => {
    expect(
      (
        await build({
          startTime: new Date('2030-06-01T11:00:00.000Z'),
        }).service.findByToken('t', NOW)
      ).canCancel,
    ).toBe(false);
    expect(
      (await build({ status: 'COMPLETED' }).service.findByToken('t', NOW))
        .canCancel,
    ).toBe(false);
  });

  it('treats an invalid token as a missing appointment without querying the DB', async () => {
    const { service, prisma } = build({ valid: false });

    await expect(service.findByToken('forged', NOW)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  });

  it('cancels atomically (confirmed + not started) and notifies the owner', async () => {
    const { service, prisma, email } = build();

    await service.cancel('appt-1.sig', 'Me enfermé', NOW);

    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'appt-1', status: 'CONFIRMED', startTime: { gt: NOW } },
      data: {
        status: 'CANCELLED',
        cancellationReason: 'Cancelada por el cliente: Me enfermé',
      },
    });
    await new Promise((r) => setImmediate(r));
    expect(email.sendClientCancellationNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@salon.mx',
        clientName: 'Ana',
        time: expect.stringMatching(/10:00/), // 15:00Z in Cancun
        reason: 'Me enfermé',
      }),
    );
  });

  it('refuses to cancel when the guarded update matches nothing', async () => {
    const { service, email } = build({ updateCount: 0 });

    await expect(
      service.cancel('appt-1.sig', undefined, NOW),
    ).rejects.toBeInstanceOf(ConflictException);
    await new Promise((r) => setImmediate(r));
    expect(email.sendClientCancellationNotice).not.toHaveBeenCalled();
  });
});
