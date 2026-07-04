import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  addDays,
  dayBoundsUtc,
  formatDate,
  formatTime,
  utcToDateKey,
  zonedToUtc,
} from '@agendly/shared';
import type { MonthDensityResponse } from '@agendly/shared';
import type { AppointmentStatus } from '../generated/prisma/client.js';

/** Calendar reads + status mutation. Client CRM lives in ClientsService. */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async findByDate(tenantId: string, date: string) {
    const { start, end } = dayBoundsUtc(date);

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

    return appointments.map((a) => this.toCalendarDto(a));
  }

  async findByWeek(tenantId: string, startDate: string) {
    const weekStart = zonedToUtc(startDate, '00:00');
    const weekEnd = zonedToUtc(addDays(startDate, 7), '00:00');

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

    return appointments.map((a) => this.toCalendarDto(a));
  }

  async findByMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<MonthDensityResponse> {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthStart = zonedToUtc(`${monthKey}-01`, '00:00');
    const nextMonth =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = zonedToUtc(nextMonth, '00:00');

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

    // Group by business-TZ day for the month density view
    const dayMap = new Map<string, { count: number; employees: string[] }>();
    for (const a of appointments) {
      const dayKey = utcToDateKey(a.startTime);
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
        tenant: { select: { name: true, slug: true } },
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

  /** Fire-and-forget, always with a logged catch. */
  private sendCancellationEmail(
    appointment: {
      clientName: string;
      clientEmail: string | null;
      startTime: Date;
      employee: { name: string };
      service: { name: string };
      tenant: { name: string; slug: string };
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
        date: formatDate(appointment.startTime),
        time: formatTime(appointment.startTime),
        slug: appointment.tenant.slug,
        reason,
      }),
    ).catch((err: Error) =>
      this.logger.error(
        `Fallo al enviar correo de cancelación: ${err.message}`,
      ),
    );
  }

  private toCalendarDto(a: {
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
  }) {
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
    };
  }
}
