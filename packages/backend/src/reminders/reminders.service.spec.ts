import { RemindersService, REMINDER_BATCH_LIMIT } from './reminders.service';

const NOW = new Date('2026-10-11T15:00:00.000Z');
const noSleep = () => Promise.resolve();

function appt(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 't1',
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
      where: { id: 'a1', reminderSentAt: null, status: 'CONFIRMED' },
      data: { reminderSentAt: NOW },
    });
    expect(email.sendBookingReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEmail: 'ana@example.com',
        businessPhone: '+52 33 1234 5678',
        time: expect.stringMatching(/9:00/), // 15:00Z = 9:00 in Mexico City
        emphasizeConfirmation: false,
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
