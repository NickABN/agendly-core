import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { AppointmentStatus } from '../generated/prisma/client.js';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async findClients(tenantId: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: { tenantId },
      select: {
        clientName: true,
        clientPhone: true,
        clientEmail: true,
        startTime: true,
        status: true,
        service: { select: { name: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    const clientMap = new Map<
      string,
      {
        name: string;
        phone: string;
        email: string | null;
        totalVisits: number;
        completedVisits: number;
        cancelledVisits: number;
        noShowVisits: number;
        lastVisit: string;
        topService: string;
      }
    >();

    for (const a of appointments) {
      const key = a.clientPhone;
      const existing = clientMap.get(key);

      if (!existing) {
        clientMap.set(key, {
          name: a.clientName,
          phone: a.clientPhone,
          email: a.clientEmail,
          totalVisits: 1,
          completedVisits: a.status === 'COMPLETED' ? 1 : 0,
          cancelledVisits: a.status === 'CANCELLED' ? 1 : 0,
          noShowVisits: a.status === 'NO_SHOW' ? 1 : 0,
          lastVisit: a.startTime.toISOString(),
          topService: a.service.name,
        });
      } else {
        existing.totalVisits++;
        if (a.status === 'COMPLETED') existing.completedVisits++;
        if (a.status === 'CANCELLED') existing.cancelledVisits++;
        if (a.status === 'NO_SHOW') existing.noShowVisits++;
        // name/email may vary between bookings — keep the latest
        if (!existing.email && a.clientEmail) existing.email = a.clientEmail;
      }
    }

    return Array.from(clientMap.values()).sort(
      (a, b) => b.totalVisits - a.totalVisits,
    );
  }

  async findByDate(tenantId: string, date: string) {
    // Use Mexico City timezone offset to query correct UTC range
    const dayStart = this.toMexicoUTC(date, '00:00:00');
    const dayEnd = this.toMexicoUTC(date, '23:59:59');

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

  async findByMonth(tenantId: string, year: number, month: number) {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const monthStart = this.toMexicoUTC(`${year}-${String(month).padStart(2, '0')}-01`, '00:00:00');
    const monthEnd = this.toMexicoUTC(`${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`, '23:59:59');

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: monthStart, lte: monthEnd },
      },
      select: {
        id: true,
        startTime: true,
        status: true,
        employee: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Group by day for calendar view (use Mexico City timezone to avoid UTC date shift)
    const dayMap = new Map<string, { count: number; employees: string[] }>();
    for (const a of appointments) {
      const dayKey = a.startTime.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
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

  async findByWeek(tenantId: string, startDate: string) {
    const weekStart = this.toMexicoUTC(startDate, '00:00:00');
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

  /**
   * Convert a date + time meant as Mexico City local time into a UTC Date.
   * Uses Intl to detect the real UTC offset (handles DST automatically).
   */
  private toMexicoUTC(date: string, time: string): Date {
    // Create a Date where we know the numeric parts we want in Mexico TZ
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm, ss] = time.split(':').map(Number);

    // Get Mexico City's current UTC offset for that date
    // by formatting a reference date and comparing
    const ref = new Date(Date.UTC(y, m - 1, d, 12)); // noon UTC as safe reference
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      timeZoneName: 'shortOffset',
    }).formatToParts(ref);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT-6';
    // tzPart is like "GMT-6" or "GMT-5"
    const offsetMatch = tzPart.match(/GMT([+-]\d+)/);
    const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -6;

    // Build UTC date: Mexico local time minus offset = UTC
    return new Date(Date.UTC(y, m - 1, d, hh - offsetHours, mm, ss || 0));
  }
}
