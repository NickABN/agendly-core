import { BadRequestException } from '@nestjs/common';
import { InsightsService, median, ratio } from './insights.service';
import { NoShowRiskService } from './no-show-risk.service';

const TENANT_ID = 't1';
const NOW = new Date('2026-10-10T18:00:00.000Z');

function appt(overrides: Record<string, unknown>) {
  return {
    status: 'COMPLETED',
    channel: 'WEB',
    startTime: new Date('2026-10-05T16:00:00.000Z'),
    createdAt: new Date('2026-10-04T16:00:00.000Z'),
    clientPhone: '+521111111111',
    clientEmail: 'a@b.mx',
    bookingDurationSec: null,
    reminderSentAt: null,
    ...overrides,
  };
}

function build(
  rows: unknown[],
  earlierClients: unknown[] = [],
  history: unknown[] = [],
) {
  const findMany = jest
    .fn()
    // 1) range appointments, 2) returning clients, 3) risk history
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce(earlierClients)
    .mockResolvedValueOnce(history);
  const prisma = {
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ timezone: 'America/Mexico_City' }),
    },
    appointment: { findMany },
  };
  const risk = new NoShowRiskService(prisma as never);
  return { service: new InsightsService(prisma as never, risk), findMany };
}

describe('median / ratio', () => {
  it('median handles odd, even and empty inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('ratio rounds to 3 decimals and guards zero', () => {
    expect(ratio(1, 3)).toBe(0.333);
    expect(ratio(1, 0)).toBeNull();
  });
});

describe('InsightsService.summary', () => {
  it('defaults to the last 30 days in the tenant timezone', async () => {
    const { service, findMany } = build([]);
    const res = await service.summary(TENANT_ID, undefined, undefined, NOW);
    expect(res.from).toBe('2026-09-11');
    expect(res.to).toBe('2026-10-10');
    // Mexico City is UTC-6: the range starts at 06:00Z
    expect(findMany.mock.calls[0][0].where.startTime.gte).toEqual(
      new Date('2026-09-11T06:00:00.000Z'),
    );
    expect(res.noShowRate).toBeNull();
    expect(res.riskModel.samples).toBe(0);
  });

  it('computes rates, channels, medians, weekly series and returning clients', async () => {
    const rows = [
      appt({
        bookingDurationSec: 40,
        reminderSentAt: new Date('2026-10-04T16:00:00.000Z'),
      }),
      appt({
        status: 'NO_SHOW',
        clientPhone: '+522222222222',
        channel: 'WEB',
        bookingDurationSec: 80,
      }),
      appt({ status: 'CANCELLED', channel: 'MANUAL' }),
      appt({
        status: 'CONFIRMED',
        channel: 'MANUAL',
        startTime: new Date('2026-10-12T16:00:00.000Z'),
        createdAt: new Date('2026-10-10T16:00:00.000Z'),
      }),
    ];
    const { service } = build(rows, [{ clientPhone: '+521111111111' }]);
    const res = await service.summary(
      TENANT_ID,
      '2026-10-01',
      '2026-10-31',
      NOW,
    );

    expect(res.totals).toEqual({
      appointments: 4,
      completed: 1,
      noShows: 1,
      cancelled: 1,
      upcoming: 1,
    });
    expect(res.byChannel).toEqual({ WEB: 2, MANUAL: 2, WHATSAPP: 0 });
    expect(res.noShowRate).toBe(0.5);
    expect(res.cancellationRate).toBe(0.25);
    expect(res.autonomousShare).toBe(0.5);
    expect(res.medianLeadTimeHours).toBe(24);
    expect(res.medianBookingDurationSec).toBe(60);
    expect(res.uniqueClients).toBe(2);
    expect(res.returningClients).toBe(1);
    expect(res.weekly).toEqual([
      { weekStart: '2026-10-05', total: 3, autonomous: 2, noShows: 1 },
      { weekStart: '2026-10-12', total: 1, autonomous: 0, noShows: 0 },
    ]);
    expect(res.reminders).toEqual({
      sent: 1,
      noShowRateWithReminder: 0,
      noShowRateWithoutReminder: 1,
    });
    expect(res.riskModel.samples).toBe(2);
    expect(res.riskModel.noShows).toBe(1);
  });

  it('rejects inverted and over-long ranges', async () => {
    await expect(
      build([]).service.summary(TENANT_ID, '2026-10-10', '2026-10-01', NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build([]).service.summary(TENANT_ID, '2024-01-01', '2026-01-01', NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
