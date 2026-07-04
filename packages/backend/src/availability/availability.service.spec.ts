import { AvailabilityService } from './availability.service';
import { zonedToUtc } from '@agendly/shared';

// Slots ahora son instantes UTC ISO: la hora de pared de México (UTC-6) + offset.
const at = (time: string, date = '2026-03-20') => zonedToUtc(date, time);
const iso = (time: string, date = '2026-03-20') => at(time, date).toISOString();

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

  it('respects buffer time between slots', () => {
    const slots = service.generateSlots(
      '2026-03-20',
      '09:00',
      '12:00',
      60,
      15,
      [],
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
    );

    expect(slots).toEqual([
      { start: iso('09:00'), end: iso('09:30') },
      { start: iso('09:30'), end: iso('10:00') },
    ]);
  });

  it('returns empty array when service does not fit in work hours', () => {
    expect(
      service.generateSlots('2026-03-20', '09:00', '09:30', 60, 0, []),
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
    );

    // 00:00-01:00 choca con (clamp) 00:00-00:30 → excluido; 01:00-02:00 libre
    expect(slots).toEqual([{ start: iso('01:00'), end: iso('02:00') }]);
  });
});
