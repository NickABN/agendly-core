import { AvailabilityService } from './availability.service';
import { BUSINESS_TZ, zonedToUtc } from '@agendly/shared';

// Slots son instantes UTC ISO: la hora de pared del negocio + offset de su zona.
const at = (time: string, date = '2026-03-20', tz = BUSINESS_TZ) =>
  zonedToUtc(date, time, tz);
const iso = (time: string, date = '2026-03-20', tz = BUSINESS_TZ) =>
  at(time, date, tz).toISOString();

describe('AvailabilityService.generateSlots', () => {
  let service: AvailabilityService;

  beforeEach(() => {
    service = new AvailabilityService(null as never);
  });

  it('generates UTC instant slots for a full work day', () => {
    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60,
      0,
      [],
      BUSINESS_TZ,
    );

    expect(slots).toEqual([
      { start: iso('09:00'), end: iso('10:00') },
      { start: iso('10:00'), end: iso('11:00') },
      { start: iso('11:00'), end: iso('12:00') },
    ]);
    // Contract: every emitted instant carries the Z suffix
    expect(
      slots.every((s) => s.start.endsWith('Z') && s.end.endsWith('Z')),
    ).toBe(true);
  });

  it('generates slots at the tenant wall clock for a non-CDMX timezone (Tijuana)', () => {
    // 2026-07-03: Tijuana observes DST → UTC-7 (CDMX is UTC-6)
    const slots = service.generateSlots(
      '2026-07-03',
      '09:00',
      '17:00',
      60,
      0,
      [],
      'America/Tijuana',
    );

    expect(slots[0]).toEqual({
      start: '2026-07-03T16:00:00.000Z', // 09:00 Tijuana
      end: '2026-07-03T17:00:00.000Z',
    });
    expect(slots[slots.length - 1]).toEqual({
      start: '2026-07-03T23:00:00.000Z', // 16:00 Tijuana
      end: '2026-07-04T00:00:00.000Z', // 17:00 Tijuana
    });
    expect(slots).toHaveLength(8);
  });

  it('generates slots at the tenant wall clock for a fixed-offset timezone (Cancun)', () => {
    // Cancun is UTC-5 year-round (no DST)
    const slots = service.generateSlots(
      '2026-07-03',
      '09:00',
      '11:00',
      60,
      0,
      [],
      'America/Cancun',
    );

    expect(slots).toEqual([
      { start: '2026-07-03T14:00:00.000Z', end: '2026-07-03T15:00:00.000Z' },
      { start: '2026-07-03T15:00:00.000Z', end: '2026-07-03T16:00:00.000Z' },
    ]);
  });

  it('respects buffer time between slots', () => {
    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60,
      15,
      [],
      BUSINESS_TZ,
    );

    // 09:00-10:00 + 15 min buffer → 10:15-11:15; 11:30-12:30 no cabe
    expect(slots).toEqual([
      { start: iso('09:00'), end: iso('10:00') },
      { start: iso('10:15'), end: iso('11:15') },
    ]);
  });

  it('excludes slots that overlap with existing appointments', () => {
    const booked = [{ start: at('10:00'), end: at('11:00') }];

    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60,
      0,
      booked,
      BUSINESS_TZ,
    );

    expect(slots).toEqual([
      { start: iso('09:00'), end: iso('10:00') },
      { start: iso('11:00'), end: iso('12:00') },
    ]);
  });

  it('handles 30-minute services correctly', () => {
    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '10:00',
      30,
      0,
      [],
      BUSINESS_TZ,
    );

    expect(slots).toEqual([
      { start: iso('09:00'), end: iso('09:30') },
      { start: iso('09:30'), end: iso('10:00') },
    ]);
  });

  it('returns empty array when service does not fit in work hours', () => {
    expect(
      service.generateSlots(
        '2026-03-20',
        '09:00',
        '09:30',
        60,
        0,
        [],
        BUSINESS_TZ,
      ),
    ).toEqual([]);
  });

  it('handles multiple booked appointments', () => {
    const booked = [
      { start: at('09:00'), end: at('10:00') },
      { start: at('11:00'), end: at('12:00') },
    ];

    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '13:00',
      60,
      0,
      booked,
      BUSINESS_TZ,
    );

    expect(slots).toEqual([
      { start: iso('10:00'), end: iso('11:00') },
      { start: iso('12:00'), end: iso('13:00') },
    ]);
  });

  it('handles partial overlap correctly', () => {
    const booked = [{ start: at('09:30'), end: at('10:30') }];

    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60,
      0,
      booked,
      BUSINESS_TZ,
    );

    expect(slots).toEqual([{ start: iso('11:00'), end: iso('12:00') }]);
  });

  it('blocks time from an appointment that started the previous day and crosses midnight', () => {
    // Cita 23:30 (día anterior) → 00:30 (este día): debe bloquear el bloque de 00:00
    const booked = [
      { start: at('23:30', '2026-03-19'), end: at('00:30', '2026-03-20') },
    ];

    const slots = service.generateSlots(
      '2026-03-20',
      '00:00',
      '02:00',
      60,
      0,
      booked,
      BUSINESS_TZ,
    );

    // 00:00-01:00 choca con (clamp) 00:00-00:30 → excluido; 01:00-02:00 libre
    expect(slots).toEqual([{ start: iso('01:00'), end: iso('02:00') }]);
  });

  it('clamps cross-midnight bookings against the tenant-TZ midnight, not CDMX midnight', () => {
    // Tijuana day 2026-07-03 starts at 07:00Z. An appointment 23:30→00:30
    // Tijuana wall time crosses that midnight and must block the 00:00 block.
    const booked = [
      {
        start: at('23:30', '2026-07-02', 'America/Tijuana'),
        end: at('00:30', '2026-07-03', 'America/Tijuana'),
      },
    ];

    const slots = service.generateSlots(
      '2026-07-03',
      '00:00',
      '02:00',
      60,
      0,
      booked,
      'America/Tijuana',
    );

    expect(slots).toEqual([
      {
        start: iso('01:00', '2026-07-03', 'America/Tijuana'),
        end: iso('02:00', '2026-07-03', 'America/Tijuana'),
      },
    ]);
  });
});

describe('AvailabilityService.getAvailableSlots (tenant timezone threading)', () => {
  const FRIDAY = '2026-07-03';

  function buildPrisma(
    overrides: Partial<{
      exception: unknown;
      schedules: unknown[];
      appointments: unknown[];
      serviceAvailability: unknown[];
    }> = {},
  ) {
    return {
      scheduleException: {
        findUnique: jest.fn().mockResolvedValue(overrides.exception ?? null),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue(overrides.appointments ?? []),
      },
      schedule: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            overrides.schedules ?? [{ startTime: '09:00', endTime: '17:00' }],
          ),
      },
      serviceAvailability: {
        findMany: jest
          .fn()
          .mockResolvedValue(overrides.serviceAvailability ?? []),
      },
    };
  }

  const baseParams = {
    tenantId: 'tenant-1',
    employeeId: 'emp-1',
    serviceDurationMinutes: 60,
    bufferMinutes: 0,
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queries appointments overlapping the tenant-TZ day bounds (Tijuana)', async () => {
    const prisma = buildPrisma();
    const service = new AvailabilityService(prisma as never);

    const slots = await service.getAvailableSlots({
      ...baseParams,
      date: FRIDAY,
      timezone: 'America/Tijuana',
    });

    // 09:00 Tijuana (UTC-7 in July) = 16:00Z
    expect(slots[0].start).toBe('2026-07-03T16:00:00.000Z');
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startTime: { lt: new Date('2026-07-04T07:00:00.000Z') },
          endTime: { gt: new Date('2026-07-03T07:00:00.000Z') },
        }),
      }),
    );
  });

  it('looks up the schedule exception by civil date, independent of timezone', async () => {
    const prisma = buildPrisma();
    const service = new AvailabilityService(prisma as never);

    await service.getAvailableSlots({
      ...baseParams,
      date: FRIDAY,
      timezone: 'America/Tijuana',
    });

    expect(prisma.scheduleException.findUnique).toHaveBeenCalledWith({
      where: {
        employeeId_date: {
          employeeId: 'emp-1',
          date: new Date('2026-07-03T00:00:00.000Z'),
        },
      },
    });
  });

  it('filters past slots using "today" in the tenant timezone, not CDMX', async () => {
    // 2026-07-04T06:30Z = 23:30 July 3 in Tijuana (today, all slots past)
    //                    = 00:30 July 4 in CDMX (July 3 already over)
    jest.useFakeTimers().setSystemTime(new Date('2026-07-04T06:30:00.000Z'));

    const tijuanaService = new AvailabilityService(buildPrisma() as never);
    const tijuanaSlots = await tijuanaService.getAvailableSlots({
      ...baseParams,
      date: FRIDAY,
      timezone: 'America/Tijuana',
    });
    expect(tijuanaSlots).toEqual([]); // still July 3 in Tijuana and 23:30 > all slots

    // Same instant, CDMX tenant asking for July 4 (its "today", 00:30): slots remain
    const cdmxService = new AvailabilityService(buildPrisma() as never);
    const cdmxSlots = await cdmxService.getAvailableSlots({
      ...baseParams,
      date: '2026-07-04',
      timezone: BUSINESS_TZ,
    });
    expect(cdmxSlots.length).toBeGreaterThan(0);
  });

  it('applies service availability windows in tenant wall-clock minutes', async () => {
    const prisma = buildPrisma({
      serviceAvailability: [{ startTime: '09:00', endTime: '12:00' }],
    });
    const service = new AvailabilityService(prisma as never);

    const slots = await service.getAvailableSlots({
      ...baseParams,
      serviceId: 'svc-1',
      date: FRIDAY,
      timezone: 'America/Tijuana',
    });

    // Only 09:00, 10:00, 11:00 Tijuana survive the 09:00-12:00 window
    expect(slots.map((s) => s.start)).toEqual([
      '2026-07-03T16:00:00.000Z',
      '2026-07-03T17:00:00.000Z',
      '2026-07-03T18:00:00.000Z',
    ]);
  });
});
