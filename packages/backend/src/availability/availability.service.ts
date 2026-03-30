import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DayOfWeek } from '../generated/prisma/client.js';

export interface TimeSlot {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'SUNDAY' as DayOfWeek,
  1: 'MONDAY' as DayOfWeek,
  2: 'TUESDAY' as DayOfWeek,
  3: 'WEDNESDAY' as DayOfWeek,
  4: 'THURSDAY' as DayOfWeek,
  5: 'FRIDAY' as DayOfWeek,
  6: 'SATURDAY' as DayOfWeek,
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns available time slots for a given employee on a given date.
   * Considers: schedule, exceptions, existing appointments, and service duration + buffer.
   */
  async getAvailableSlots(params: {
    tenantId: string;
    employeeId: string;
    date: string; // YYYY-MM-DD
    serviceDurationMinutes: number;
    bufferMinutes: number;
    serviceId?: string;
  }): Promise<TimeSlot[]> {
    const { tenantId, employeeId, date, serviceDurationMinutes, bufferMinutes, serviceId } = params;

    // Use Mexico City timezone for correct day-of-week and date range
    const dayStart = this.toMexicoCityUTC(date, '00:00:00');
    const dayEnd = this.toMexicoCityUTC(date, '23:59:59');

    // Get day of week in Mexico timezone
    const [y, m, d] = date.split('-').map(Number);
    const localDate = new Date(y, m - 1, d); // local midnight, just for getDay()
    const dayOfWeek = DAY_MAP[localDate.getDay()];

    // 1. Check for schedule exception on this date
    const exception = await this.prisma.scheduleException.findUnique({
      where: {
        employeeId_date: { employeeId, date: dayStart },
      },
    });

    // 3. Get existing appointments for this employee on this date (UTC range for Mexico day)
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        employeeId,
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
        status: { in: ['CONFIRMED'] },
      },
      orderBy: { startTime: 'asc' },
    });

    const bookedSlots = appointments.map((a) => ({
      start: a.startTime,
      end: a.endTime,
    }));

    if (exception) {
      // Exception exists: day off (null times) or modified hours
      if (!exception.startTime || !exception.endTime) {
        return []; // Day off
      }
      return this.generateSlotsForBlocks(
        date,
        [{ startTime: exception.startTime, endTime: exception.endTime }],
        serviceDurationMinutes,
        bufferMinutes,
        bookedSlots,
      );
    }

    // 2. Get regular schedule for this day (multiple blocks)
    const schedules = await this.prisma.schedule.findMany({
      where: { employeeId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    if (schedules.length === 0) {
      return []; // Not working this day
    }

    const blocks = schedules.map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
    let slots = this.generateSlotsForBlocks(
      date,
      blocks,
      serviceDurationMinutes,
      bufferMinutes,
      bookedSlots,
    );

    // 4. Filter by service availability if serviceId provided
    if (serviceId) {
      const serviceAvail = await this.prisma.serviceAvailability.findMany({
        where: { serviceId, dayOfWeek },
      });
      if (serviceAvail.length > 0) {
        slots = slots.filter((slot) => {
          const timePart = slot.start.split('T')[1];
          const [h, min] = timePart.split(':').map(Number);
          const slotMinutes = h * 60 + min;
          return serviceAvail.some((sa) => {
            if (!sa.startTime || !sa.endTime) return true;
            const [saH, saM] = sa.startTime.split(':').map(Number);
            const [saEH, saEM] = sa.endTime.split(':').map(Number);
            return slotMinutes >= saH * 60 + saM && slotMinutes < saEH * 60 + saEM;
          });
        });
      }
    }

    return slots;
  }

  /**
   * Generates available time slots across multiple schedule blocks.
   */
  generateSlotsForBlocks(
    date: string,
    blocks: Array<{ startTime: string; endTime: string }>,
    durationMinutes: number,
    bufferMinutes: number,
    bookedSlots: Array<{ start: Date; end: Date }>,
  ): TimeSlot[] {
    const allSlots: TimeSlot[] = [];
    for (const block of blocks) {
      allSlots.push(
        ...this.generateSlots(
          date,
          block.startTime,
          block.endTime,
          durationMinutes,
          bufferMinutes,
          bookedSlots,
        ),
      );
    }
    return allSlots;
  }

  /**
   * Pure function that generates available time slots.
   * Exposed for testing.
   */
  generateSlots(
    date: string,
    workStart: string, // HH:mm
    workEnd: string,   // HH:mm
    durationMinutes: number,
    bufferMinutes: number,
    bookedSlots: Array<{ start: Date; end: Date }>,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const totalMinutes = durationMinutes + bufferMinutes;

    const [startH, startM] = workStart.split(':').map(Number);
    const [endH, endM] = workEnd.split(':').map(Number);

    const workStartMinutes = startH * 60 + startM;
    const workEndMinutes = endH * 60 + endM;

    // Convert booked slots to minute ranges using Mexico City timezone
    const booked = bookedSlots.map((slot) => ({
      start: this.toMexicoCityMinutes(slot.start),
      end: this.toMexicoCityMinutes(slot.end),
    }));

    let cursor = workStartMinutes;

    while (cursor + durationMinutes <= workEndMinutes) {
      const slotEnd = cursor + durationMinutes;

      // Check if this slot overlaps with any booked appointment
      const isOverlapping = booked.some(
        (b) => cursor < b.end && slotEnd > b.start,
      );

      if (!isOverlapping) {
        const startHour = String(Math.floor(cursor / 60)).padStart(2, '0');
        const startMin = String(cursor % 60).padStart(2, '0');
        const endHour = String(Math.floor(slotEnd / 60)).padStart(2, '0');
        const endMin = String(slotEnd % 60).padStart(2, '0');

        slots.push({
          start: `${date}T${startHour}:${startMin}:00`,
          end: `${date}T${endHour}:${endMin}:00`,
        });
      }

      // Advance by buffer after the slot
      cursor += totalMinutes;
    }

    return slots;
  }

  /**
   * Convert a date + time string meant as Mexico City local time into a UTC Date.
   * Handles DST automatically via Intl.
   */
  private toMexicoCityUTC(date: string, time: string): Date {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm, ss] = time.split(':').map(Number);

    // Get Mexico City's UTC offset for this date
    const ref = new Date(Date.UTC(y, m - 1, d, 12));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      timeZoneName: 'shortOffset',
    }).formatToParts(ref);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT-6';
    const offsetMatch = tzPart.match(/GMT([+-]\d+)/);
    const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -6;

    return new Date(Date.UTC(y, m - 1, d, hh - offsetHours, mm, ss || 0));
  }

  /**
   * Extract hours:minutes in Mexico City timezone from a UTC Date, as total minutes since midnight.
   */
  private toMexicoCityMinutes(utcDate: Date): number {
    const timeStr = utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/Mexico_City',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }
}
