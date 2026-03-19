import { AvailabilityService } from './availability.service';

describe('AvailabilityService.generateSlots', () => {
  let service: AvailabilityService;

  beforeEach(() => {
    service = new AvailabilityService(null as any);
  });

  it('generates correct slots for a full work day', () => {
    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60, // 1 hour service
      0,  // no buffer
      [],
    );

    expect(slots).toEqual([
      { start: '2026-03-20T09:00:00', end: '2026-03-20T10:00:00' },
      { start: '2026-03-20T10:00:00', end: '2026-03-20T11:00:00' },
      { start: '2026-03-20T11:00:00', end: '2026-03-20T12:00:00' },
    ]);
  });

  it('respects buffer time between slots', () => {
    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60, // 1 hour service
      15, // 15 min buffer
      [],
    );

    // 09:00-10:00 (slot) + 15 min buffer = next at 10:15
    // 10:15-11:15 (slot) + 15 min buffer = next at 11:30
    // 11:30-12:30 > 12:00 end → doesn't fit
    expect(slots).toEqual([
      { start: '2026-03-20T09:00:00', end: '2026-03-20T10:00:00' },
      { start: '2026-03-20T10:15:00', end: '2026-03-20T11:15:00' },
    ]);
  });

  it('excludes slots that overlap with existing appointments', () => {
    const booked = [
      {
        start: new Date('2026-03-20T10:00:00'),
        end: new Date('2026-03-20T11:00:00'),
      },
    ];

    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60,
      0,
      booked,
    );

    expect(slots).toEqual([
      { start: '2026-03-20T09:00:00', end: '2026-03-20T10:00:00' },
      { start: '2026-03-20T11:00:00', end: '2026-03-20T12:00:00' },
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
    );

    expect(slots).toEqual([
      { start: '2026-03-20T09:00:00', end: '2026-03-20T09:30:00' },
      { start: '2026-03-20T09:30:00', end: '2026-03-20T10:00:00' },
    ]);
  });

  it('returns empty array when service does not fit in work hours', () => {
    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '09:30',
      60, // 1 hour service doesn't fit in 30 min window
      0,
      [],
    );

    expect(slots).toEqual([]);
  });

  it('handles multiple booked appointments', () => {
    const booked = [
      {
        start: new Date('2026-03-20T09:00:00'),
        end: new Date('2026-03-20T10:00:00'),
      },
      {
        start: new Date('2026-03-20T11:00:00'),
        end: new Date('2026-03-20T12:00:00'),
      },
    ];

    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '13:00',
      60,
      0,
      booked,
    );

    expect(slots).toEqual([
      { start: '2026-03-20T10:00:00', end: '2026-03-20T11:00:00' },
      { start: '2026-03-20T12:00:00', end: '2026-03-20T13:00:00' },
    ]);
  });

  it('handles partial overlap correctly', () => {
    const booked = [
      {
        start: new Date('2026-03-20T09:30:00'),
        end: new Date('2026-03-20T10:30:00'),
      },
    ];

    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60,
      0,
      booked,
    );

    // 09:00-10:00 overlaps with 09:30-10:30 → excluded
    // 10:00-11:00 overlaps with 09:30-10:30 → excluded
    // 11:00-12:00 → available
    expect(slots).toEqual([
      { start: '2026-03-20T11:00:00', end: '2026-03-20T12:00:00' },
    ]);
  });
});
