import { RemindersService, REMINDER_BATCH_LIMIT } from './reminders.service';

const NOW = new Date('2026-10-11T15:00:00.000Z');
const noSleep = () => Promise.resolve();

function appt(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 't1',
    employeeId: 'e1',
    clientName: 'Ana',
    clientPhone: '+521',
    clientEmail: 'ana@example.com',
    status: 'CONFIRMED',
    channel: 'WEB',
    startTime: new Date('2026-10-12T15:00:00.000Z'),
    createdAt: new Date('2026-10-01T15:00:00.000Z'),
    employee: { name: 'Luisa' },
    service: { name: 'Manicure' },
    tenant: {
      name: 'Bellas Nails',
      slug: 'bellas-nails',
      phone: '+52 33 1234 5678',
      timezone: 'America/Mexico_City',
      isActive: true,
      subscriptionStatus: 'TRIALING',
      trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    ...overrides,
  };
}

function build(
  candidates: unknown[],
  opts: { claimCount?: number; sendOk?: boolean } = {},
) {
  const prisma = {
    appointment: {
      findMany: jest.fn().mockResolvedValue(candidates),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
    },
  };
  const email = {
    sendBookingReminder: jest.fn().mockResolvedValue(opts.sendOk ?? true),
  };
  const risk = { annotate: jest.fn().mockResolvedValue(new Map()) };
  const service = new RemindersService(
    prisma as never,
    email as never,
    risk as never,
    { manageUrl: (id: string) => `https://app.test/cita/${id}.sig` } as never,
  );
  return { service, prisma, email, risk };
}

describe('RemindersService.sendDueReminders', () => {
  const original = process.env.BILLING_ENFORCED;
  afterEach(() => {
    process.env.BILLING_ENFORCED = original;
  });

  it('queries confirmed, unreminded appointments in the 1–24 h window booked ≥ 12 h ago', async () => {
    const { service, prisma } = build([]);
    await service.sendDueReminders(NOW, noSleep);
    const args = prisma.appointment.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      status: 'CONFIRMED',
      reminderSentAt: null,
      clientEmail: { not: null },
      startTime: {
        gt: new Date('2026-10-11T16:00:00.000Z'),
        lte: new Date('2026-10-12T15:00:00.000Z'),
      },
      createdAt: { lte: new Date('2026-10-11T03:00:00.000Z') },
    });
    expect(args.take).toBe(REMINDER_BATCH_LIMIT);
  });

  it('claims, then sends in the tenant timezone with the business phone', async () => {
    const { service, prisma, email } = build([appt('a1')]);
    const res = await service.sendDueReminders(NOW, noSleep);

    expect(res).toEqual({ candidates: 1, sent: 1, failed: 0 });
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'a1',
        reminderSentAt: null,
        status: 'CONFIRMED',
        startTime: new Date('2026-10-12T15:00:00.000Z'),
        employeeId: 'e1',
      },
      data: { reminderSentAt: NOW },
    });
    expect(email.sendBookingReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEmail: 'ana@example.com',
        businessPhone: '+52 33 1234 5678',
        time: expect.stringMatching(/9:00/), // 15:00Z = 9:00 in Mexico City
        emphasizeConfirmation: false,
        manageUrl: 'https://app.test/cita/a1.sig',
      }),
    );
  });

  it('emphasizes confirmation for HIGH-risk appointments', async () => {
    const { service, risk, email } = build([appt('a1')]);
    risk.annotate.mockResolvedValue(new Map([['a1', { level: 'HIGH' }]]));
    await service.sendDueReminders(NOW, noSleep);
    expect(email.sendBookingReminder).toHaveBeenCalledWith(
      expect.objectContaining({ emphasizeConfirmation: true }),
    );
  });

  it('skips appointments another run already claimed', async () => {
    const { service, email } = build([appt('a1')], { claimCount: 0 });
    const res = await service.sendDueReminders(NOW, noSleep);
    expect(email.sendBookingReminder).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
  });

  it('skips a candidate rescheduled after selection and later reminds using its current data', async () => {
    const staleCandidate = appt('a1', {
      employeeId: 'e1',
      employee: { name: 'Luisa' },
      startTime: new Date('2026-10-12T14:00:00.000Z'),
    });
    const movedCandidate = appt('a1', {
      employeeId: 'e2',
      employee: { name: 'María' },
      startTime: new Date('2026-10-12T15:00:00.000Z'),
    });
    let current = staleCandidate;
    let rescheduled = false;
    let findManyCalls = 0;
    const prisma = {
      appointment: {
        findMany: jest.fn().mockImplementation(async () => {
          findManyCalls += 1;
          return [findManyCalls === 1 ? staleCandidate : current];
        }),
        updateMany: jest
          .fn()
          .mockImplementation(
            async ({ where }: { where: Record<string, unknown> }) => {
              if (!rescheduled) {
                current = movedCandidate;
                rescheduled = true;
              }
              const startMatches =
                where.startTime === undefined ||
                (where.startTime instanceof Date &&
                  where.startTime.getTime() ===
                    (current.startTime as Date).getTime());
              const employeeMatches =
                where.employeeId === undefined ||
                where.employeeId === current.employeeId;
              const matches =
                where.id === current.id &&
                where.status === current.status &&
                where.reminderSentAt === null &&
                startMatches &&
                employeeMatches;
              return { count: matches ? 1 : 0 };
            },
          ),
      },
    };
    const email = { sendBookingReminder: jest.fn().mockResolvedValue(true) };
    const service = new RemindersService(
      prisma as never,
      email as never,
      { annotate: jest.fn().mockResolvedValue(new Map()) } as never,
      { manageUrl: (id: string) => `https://app.test/cita/${id}.sig` } as never,
    );

    const firstRun = await service.sendDueReminders(NOW, noSleep);

    expect(firstRun).toEqual({ candidates: 1, sent: 0, failed: 0 });
    expect(prisma.appointment.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'a1',
        reminderSentAt: null,
        status: 'CONFIRMED',
        startTime: staleCandidate.startTime,
        employeeId: 'e1',
      },
      data: { reminderSentAt: NOW },
    });
    expect(email.sendBookingReminder).not.toHaveBeenCalled();

    const secondRun = await service.sendDueReminders(NOW, noSleep);

    expect(secondRun).toEqual({ candidates: 1, sent: 1, failed: 0 });
    expect(prisma.appointment.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'a1',
        reminderSentAt: null,
        status: 'CONFIRMED',
        startTime: movedCandidate.startTime,
        employeeId: 'e2',
      },
      data: { reminderSentAt: NOW },
    });
    expect(email.sendBookingReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeName: 'María',
        time: expect.stringMatching(/9:00/),
      }),
    );
  });

  it('releases the claim when the provider fails so the next run retries', async () => {
    const { service, prisma } = build([appt('a1')], { sendOk: false });
    const res = await service.sendDueReminders(NOW, noSleep);
    expect(res.failed).toBe(1);
    expect(prisma.appointment.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'a1', reminderSentAt: NOW },
      data: { reminderSentAt: null },
    });
  });

  it('skips tenants without access (deactivated)', async () => {
    const { service, email } = build([
      appt('a1', { tenant: { ...appt('x').tenant, isActive: false } }),
    ]);
    await service.sendDueReminders(NOW, noSleep);
    expect(email.sendBookingReminder).not.toHaveBeenCalled();
  });
});
