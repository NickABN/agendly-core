import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AppointmentLinkService } from '../email/appointment-link.service';
import { NoShowRiskService } from '../insights/no-show-risk.service';
import { AvailabilityService } from '../availability/availability.service';
import { isNoOverlapViolation } from '../availability/booking.service';
import {
  BUSINESS_TZ,
  addDays,
  dayBoundsUtc,
  formatDate,
  formatTime,
  isPast,
  utcToDateKey,
  zonedToUtc,
} from '@agendly/shared';
import type {
  MonthDensityResponse,
  NoShowRiskDto,
  RescheduleResponse,
  TimeSlotDto,
} from '@agendly/shared';
import type { AppointmentStatus } from '../generated/prisma/client.js';

/** Calendar reads + status mutation. Client CRM lives in ClientsService. */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly riskService: NoShowRiskService,
    private readonly availabilityService: AvailabilityService,
    private readonly appointmentLinks: AppointmentLinkService,
  ) {}

  /**
   * Tenant timezone for calendar day boundaries. One indexed PK lookup per
   * calendar read; the tenant row is not otherwise loaded on these paths.
   */
  private async tenantTimezone(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return tenant?.timezone ?? BUSINESS_TZ;
  }

  async findByDate(tenantId: string, date: string) {
    const timezone = await this.tenantTimezone(tenantId);
    const { start, end } = dayBoundsUtc(date, timezone);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: start, lt: end },
      },
      include: {
        employee: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const risks = await this.riskService.annotate(tenantId, appointments);
    return appointments.map((a) =>
      this.toCalendarDto(a, risks.get(a.id) ?? null),
    );
  }

  async findByWeek(tenantId: string, startDate: string) {
    const timezone = await this.tenantTimezone(tenantId);
    const weekStart = zonedToUtc(startDate, '00:00', timezone);
    const weekEnd = zonedToUtc(addDays(startDate, 7), '00:00', timezone);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: weekStart, lt: weekEnd },
      },
      include: {
        employee: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const risks = await this.riskService.annotate(tenantId, appointments);
    return appointments.map((a) =>
      this.toCalendarDto(a, risks.get(a.id) ?? null),
    );
  }

  async findByMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<MonthDensityResponse> {
    const timezone = await this.tenantTimezone(tenantId);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthStart = zonedToUtc(`${monthKey}-01`, '00:00', timezone);
    const nextMonth =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = zonedToUtc(nextMonth, '00:00', timezone);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true,
        startTime: true,
        status: true,
        employee: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Group by tenant-TZ day for the month density view
    const dayMap = new Map<string, { count: number; employees: string[] }>();
    for (const a of appointments) {
      const dayKey = utcToDateKey(a.startTime, timezone);
      const existing = dayMap.get(dayKey);
      if (!existing) {
        dayMap.set(dayKey, { count: 1, employees: [a.employee.name] });
      } else {
        existing.count++;
        if (!existing.employees.includes(a.employee.name)) {
          existing.employees.push(a.employee.name);
        }
      }
    }

    return Object.fromEntries(dayMap);
  }

  async updateStatus(
    tenantId: string,
    appointmentId: string,
    status: AppointmentStatus,
    cancellationReason?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        employee: { select: { name: true } },
        service: { select: { name: true } },
        tenant: { select: { name: true, slug: true, timezone: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status, cancellationReason },
    });

    if (status === 'CANCELLED' && appointment.clientEmail) {
      this.sendCancellationEmail(appointment, cancellationReason);
    }

    return {
      id: updated.id,
      status: updated.status,
    };
  }

  /**
   * Free slots to move an appointment to: same service, the chosen (or
   * current) employee, ignoring the appointment's own current range.
   */
  async rescheduleSlots(
    tenantId: string,
    appointmentId: string,
    date: string,
    employeeId?: string,
  ): Promise<TimeSlotDto[]> {
    const appointment = await this.findReschedulable(tenantId, appointmentId);
    const targetEmployeeId = employeeId ?? appointment.employeeId;
    await this.assertEmployeeOffersService(
      tenantId,
      targetEmployeeId,
      appointment.serviceId,
    );

    return this.availabilityService.getAvailableSlots({
      tenantId,
      employeeId: targetEmployeeId,
      serviceId: appointment.serviceId,
      date,
      serviceDurationMinutes: appointment.service.durationMinutes,
      bufferMinutes: appointment.service.bufferMinutes,
      timezone: appointment.tenant.timezone,
      excludeAppointmentId: appointment.id,
    });
  }

  /**
   * Moves a CONFIRMED appointment to another free slot (optionally with
   * another employee) and emails the client. Same rules as a new booking:
   * the instant must be one of the currently available slots; the DB
   * exclusion constraint still guards against a concurrent booking.
   */
  async reschedule(
    tenantId: string,
    appointmentId: string,
    startTimeIso: string,
    employeeId?: string,
  ): Promise<RescheduleResponse> {
    const appointment = await this.findReschedulable(tenantId, appointmentId);
    const targetEmployeeId = employeeId ?? appointment.employeeId;
    const employee = await this.assertEmployeeOffersService(
      tenantId,
      targetEmployeeId,
      appointment.serviceId,
    );

    const startTime = new Date(startTimeIso);
    if (isPast(startTime)) {
      throw new BadRequestException(
        'No se puede reagendar a un horario en el pasado',
      );
    }
    if (
      startTime.getTime() === appointment.startTime.getTime() &&
      targetEmployeeId === appointment.employeeId
    ) {
      throw new BadRequestException('La cita ya está en ese horario');
    }

    const { timezone } = appointment.tenant;
    const daySlots = await this.availabilityService.getAvailableSlots({
      tenantId,
      employeeId: targetEmployeeId,
      serviceId: appointment.serviceId,
      date: utcToDateKey(startTime, timezone),
      serviceDurationMinutes: appointment.service.durationMinutes,
      bufferMinutes: appointment.service.bufferMinutes,
      timezone,
      excludeAppointmentId: appointment.id,
    });
    const requestedStart = startTime.toISOString();
    if (!daySlots.some((slot) => slot.start === requestedStart)) {
      throw new ConflictException('Este horario ya no está disponible');
    }

    const endTime = new Date(
      startTime.getTime() + appointment.service.durationMinutes * 60_000,
    );

    let updated;
    try {
      updated = await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          startTime,
          endTime,
          employeeId: targetEmployeeId,
          // New time → the 24 h reminder must go out again
          reminderSentAt: null,
        },
      });
    } catch (err) {
      if (isNoOverlapViolation(err)) {
        throw new ConflictException('Este horario ya está ocupado');
      }
      throw err;
    }

    if (appointment.clientEmail) {
      this.sendRescheduleEmail(
        { ...appointment, clientEmail: appointment.clientEmail },
        employee.name,
        startTime,
      );
    }

    return {
      id: updated.id,
      employeeId: updated.employeeId,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime.toISOString(),
    };
  }

  private async findReschedulable(tenantId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        service: {
          select: { name: true, durationMinutes: true, bufferMinutes: true },
        },
        tenant: { select: { name: true, slug: true, timezone: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }
    if (appointment.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Solo se pueden reagendar citas confirmadas',
      );
    }
    return appointment;
  }

  private async assertEmployeeOffersService(
    tenantId: string,
    employeeId: string,
    serviceId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId,
        deletedAt: null,
        isActive: true,
        services: { some: { serviceId } },
      },
      select: { id: true, name: true },
    });
    if (!employee) {
      throw new BadRequestException(
        'El profesional no está disponible para este servicio',
      );
    }
    return employee;
  }

  /** Fire-and-forget, always with a logged catch. */
  private sendRescheduleEmail(
    appointment: {
      id: string;
      clientName: string;
      clientEmail: string;
      startTime: Date;
      service: { name: string };
      tenant: { name: string; slug: string; timezone: string };
    },
    employeeName: string,
    newStart: Date,
  ): void {
    const { timezone } = appointment.tenant;
    void Promise.resolve(
      this.emailService.sendBookingRescheduled({
        clientName: appointment.clientName,
        clientEmail: appointment.clientEmail,
        serviceName: appointment.service.name,
        employeeName,
        businessName: appointment.tenant.name,
        date: formatDate(newStart, 'long', timezone),
        time: formatTime(newStart, timezone),
        previousDate: formatDate(appointment.startTime, 'long', timezone),
        previousTime: formatTime(appointment.startTime, timezone),
        slug: appointment.tenant.slug,
        manageUrl: this.appointmentLinks.manageUrl(appointment.id),
      }),
    ).catch((err: Error) =>
      this.logger.error(`Fallo al enviar correo de reagendado: ${err.message}`),
    );
  }

  /** Fire-and-forget, always with a logged catch. */
  private sendCancellationEmail(
    appointment: {
      clientName: string;
      clientEmail: string | null;
      startTime: Date;
      employee: { name: string };
      service: { name: string };
      tenant: { name: string; slug: string; timezone: string };
    },
    reason?: string,
  ): void {
    void Promise.resolve(
      this.emailService.sendBookingCancellation({
        clientName: appointment.clientName,
        clientEmail: appointment.clientEmail!,
        serviceName: appointment.service.name,
        employeeName: appointment.employee.name,
        businessName: appointment.tenant.name,
        date: formatDate(
          appointment.startTime,
          'long',
          appointment.tenant.timezone,
        ),
        time: formatTime(appointment.startTime, appointment.tenant.timezone),
        slug: appointment.tenant.slug,
        reason,
      }),
    ).catch((err: Error) =>
      this.logger.error(
        `Fallo al enviar correo de cancelación: ${err.message}`,
      ),
    );
  }

  private toCalendarDto(
    a: {
      id: string;
      clientName: string;
      clientPhone: string;
      clientEmail: string | null;
      startTime: Date;
      endTime: Date;
      status: unknown;
      channel: unknown;
      employee: { id: string; name: string };
      service: { id: string; name: string; durationMinutes: number };
    },
    noShowRisk: NoShowRiskDto | null,
  ) {
    return {
      id: a.id,
      clientName: a.clientName,
      clientPhone: a.clientPhone,
      clientEmail: a.clientEmail,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      status: a.status,
      channel: a.channel,
      employee: a.employee,
      service: a.service,
      noShowRisk,
    };
  }
}
