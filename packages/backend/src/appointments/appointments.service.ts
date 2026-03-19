import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { AppointmentStatus } from '@generated/prisma';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async findByDate(tenantId: string, date: string) {
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: dayStart, lte: dayEnd },
      },
      include: {
        employee: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return appointments.map((a) => ({
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
    }));
  }

  async findByWeek(tenantId: string, startDate: string) {
    const weekStart = new Date(startDate + 'T00:00:00');
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

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

    return appointments.map((a) => ({
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
    }));
  }

  async updateStatus(
    tenantId: string,
    appointmentId: string,
    status: string,
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
      data: {
        status: status as AppointmentStatus,
        cancellationReason,
      },
    });

    // Send cancellation email if applicable
    if (status === 'CANCELLED' && appointment.clientEmail) {
      this.emailService.sendBookingCancellation({
        clientName: appointment.clientName,
        clientEmail: appointment.clientEmail,
        serviceName: appointment.service.name,
        employeeName: appointment.employee.name,
        businessName: appointment.tenant.name,
        date: appointment.startTime.toLocaleDateString('es-MX'),
        time: appointment.startTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        slug: appointment.tenant.slug,
        reason: cancellationReason,
      });
    }

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}
