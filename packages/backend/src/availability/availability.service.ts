import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  dayBoundsUtc,
  dayOfWeekOf,
  isPast,
  minutesToTime,
  timeToMinutes,
  todayKey,
  utcToZonedMinutes,
  zonedToUtc,
} from '@agendly/shared';
import type { CheckAvailabilityRequest, TimeSlotDto } from '@agendly/shared';
import type { DayOfWeek, Service } from '../generated/prisma/client.js';

/** Sentinel employeeId for "cualquier disponible" searches. */
export const ANY_EMPLOYEE = 'any';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public slot search for the booking form. Resolves the tenant by slug,
   * validates that the service/employee belong to it and are active, and
   * supports employeeId = "any" (union across active employees offering
   * the service, each slot tagged with a concrete employeeId).
   */
  async getPublicSlots(
    params: CheckAvailabilityRequest,
  ): Promise<TimeSlotDto[]> {
    const { tenantSlug, serviceId, employeeId, date } = params;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        tenantId: tenant.id,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    if (employeeId === ANY_EMPLOYEE) {
      return this.getSlotsForAnyEmployee(tenant.id, service, date);
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: tenant.id,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const slots = await this.getAvailableSlots({
      tenantId: tenant.id,
      employeeId,
      serviceId,
      date,
      serviceDurationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    });
    return slots.map((slot) => ({ ...slot, employeeId }));
  }

  /**
   * Union of slots across every active employee that offers the service.
   * When several employees share a start time, the first one found keeps it.
   */
  private async getSlotsForAnyEmployee(
    tenantId: string,
    service: Pick<Service, 'id' | 'durationMinutes' | 'bufferMinutes'>,
    date: string,
  ): Promise<TimeSlotDto[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        services: { some: { serviceId: service.id } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byStart = new Map<string, TimeSlotDto>();
    for (const employee of employees) {
      const slots = await this.getAvailableSlots({
        tenantId,
        employeeId: employee.id,
        serviceId: service.id,
        date,
        serviceDurationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
      });
      for (const slot of slots) {
        if (!byStart.has(slot.start)) {
          byStart.set(slot.start, { ...slot, employeeId: employee.id });
        }
      }
    }

    return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
  }

  /**
   * Returns available time slots for a given employee on a given business-TZ date.
   * Considers: schedule, exceptions, existing appointments, service duration + buffer,
   * service availability windows, and (for today) already-past times.
   * Slot instants are UTC ISO strings with `Z`.
   */
  async getAvailableSlots(params: {
    tenantId: string;
    employeeId: string;
    date: string; // YYYY-MM-DD (business-TZ day)
    serviceDurationMinutes: number;
    bufferMinutes: number;
    serviceId?: string;
  }): Promise<TimeSlotDto[]> {
    const {
      tenantId,
      employeeId,
      date,
      serviceDurationMinutes,
      bufferMinutes,
      serviceId,
    } = params;

    const { start: dayStart, end: dayEnd } = dayBoundsUtc(date);
    const dayOfWeek = dayOfWeekOf(date) as DayOfWeek;

    // 1. Schedule exception for this date takes precedence over the weekly schedule
    const exception = await this.prisma.scheduleException.findUnique({
      where: {
        employeeId_date: { employeeId, date: dayStart },
      },
    });

    // 2. Existing CONFIRMED appointments that OVERLAP the day (an appointment
    //    ending after midnight still blocks its share of this day)
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        employeeId,
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
        status: 'CONFIRMED',
      },
      orderBy: { startTime: 'asc' },
    });

    const bookedSlots = appointments.map((a) => ({
      start: a.startTime,
      end: a.endTime,
    }));

    let slots: TimeSlotDto[];

    if (exception) {
      // Day off (null times) or modified hours
      if (!exception.startTime || !exception.endTime) {
        return [];
      }
      slots = this.generateSlotsForBlocks(
        date,
        [{ startTime: exception.startTime, endTime: exception.endTime }],
        serviceDurationMinutes,
        bufferMinutes,
        bookedSlots,
      );
    } else {
      const schedules = await this.prisma.schedule.findMany({
        where: { employeeId, dayOfWeek, isActive: true },
        orderBy: { startTime: 'asc' },
      });

      if (schedules.length === 0) {
        return []; // Not working this day
      }

      slots = this.generateSlotsForBlocks(
        date,
        schedules.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
        serviceDurationMinutes,
        bufferMinutes,
        bookedSlots,
      );
    }

    // 3. Filter by service availability windows if configured
    if (serviceId) {
      const serviceAvail = await this.prisma.serviceAvailability.findMany({
        where: { serviceId, dayOfWeek },
      });
      if (serviceAvail.length > 0) {
        slots = slots.filter((slot) => {
          const slotMinutes = utcToZonedMinutes(slot.start);
          return serviceAvail.some((sa) => {
            if (!sa.startTime || !sa.endTime) return true;
            const from = timeToMinutes(sa.startTime);
            const to = timeToMinutes(sa.endTime);
            return slotMinutes >= from && slotMinutes < to;
          });
        });
      }
    }

    // 4. Never offer slots that already started (today only)
    if (date === todayKey()) {
      slots = slots.filter((slot) => !isPast(slot.start));
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
  ): TimeSlotDto[] {
    const allSlots: TimeSlotDto[] = [];
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
   * Pure function that generates available time slots as UTC ISO instants.
   * Exposed for testing.
   */
  generateSlots(
    date: string,
    workStart: string, // HH:mm (business-TZ wall time)
    workEnd: string, // HH:mm
    durationMinutes: number,
    bufferMinutes: number,
    bookedSlots: Array<{ start: Date; end: Date }>,
  ): TimeSlotDto[] {
    const slots: TimeSlotDto[] = [];
    const totalMinutes = durationMinutes + bufferMinutes;

    const workStartMinutes = timeToMinutes(workStart);
    const workEndMinutes = timeToMinutes(workEnd);

    // Booked ranges as minutes relative to the business-TZ midnight of `date`,
    // clamped to the day so cross-midnight appointments still block correctly.
    const dayStartMs = zonedToUtc(date, '00:00').getTime();
    const booked = bookedSlots.map((slot) => ({
      start: Math.max(0, (slot.start.getTime() - dayStartMs) / 60_000),
      end: Math.min(24 * 60, (slot.end.getTime() - dayStartMs) / 60_000),
    }));

    let cursor = workStartMinutes;

    while (cursor + durationMinutes <= workEndMinutes) {
      const slotEnd = cursor + durationMinutes;

      const isOverlapping = booked.some(
        (b) => cursor < b.end && slotEnd > b.start,
      );

      if (!isOverlapping) {
        slots.push({
          start: zonedToUtc(date, minutesToTime(cursor)).toISOString(),
          end: zonedToUtc(date, minutesToTime(slotEnd)).toISOString(),
        });
      }

      cursor += totalMinutes;
    }

    return slots;
  }
}
