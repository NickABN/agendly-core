import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DayOfWeek } from '@generated/prisma';

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
  }): Promise<TimeSlot[]> {
    const { tenantId, employeeId, date, serviceDurationMinutes, bufferMinutes } = params;

    const targetDate = new Date(date + 'T00:00:00');
    const dayOfWeek = DAY_MAP[targetDate.getDay()];

    // 1. Check for schedule exception on this date
    const exception = await this.prisma.scheduleException.findUnique({
      where: {
        employeeId_date: { employeeId, date: targetDate },
      },
    });

    let workStart: string | null = null;
    let workEnd: string | null = null;

    if (exception) {
      // Exception exists: day off (null times) or modified hours
      if (!exception.startTime || !exception.endTime) {
        return []; // Day off
      }
      workStart = exception.startTime;
      workEnd = exception.endTime;
    } else {
      // 2. Get regular schedule for this day
      const schedule = await this.prisma.schedule.findUnique({
        where: {
          employeeId_dayOfWeek: { employeeId, dayOfWeek },
        },
      });

      if (!schedule || !schedule.isActive) {
        return []; // Not working this day
      }

      workStart = schedule.startTime;
      workEnd = schedule.endTime;
    }

    // 3. Get existing appointments for this employee on this date
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');

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

    // 4. Generate slots
    return this.generateSlots(
      date,
      workStart,
      workEnd,
      serviceDurationMinutes,
      bufferMinutes,
      appointments.map((a) => ({
        start: a.startTime,
        end: a.endTime,
      })),
    );
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

    // Convert booked slots to minute ranges
    const booked = bookedSlots.map((slot) => ({
      start: slot.start.getHours() * 60 + slot.start.getMinutes(),
      end: slot.end.getHours() * 60 + slot.end.getMinutes(),
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
}
