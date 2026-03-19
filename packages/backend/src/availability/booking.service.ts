import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import type { AppointmentChannel } from '@generated/prisma';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createBooking(tenantId: string, dto: CreateBookingDto) {
    // 1. Load the service to get duration
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId, deletedAt: null },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    // 2. Verify employee exists
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60 * 1000);

    // 3. Create appointment with double-booking check inside a transaction
    const appointment = await this.prisma.$transaction(async (tx) => {
      const overlapping = await tx.appointment.findFirst({
        where: {
          tenantId,
          employeeId: dto.employeeId,
          status: 'CONFIRMED',
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (overlapping) {
        throw new ConflictException('Este horario ya está ocupado');
      }

      const appt = await tx.appointment.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          serviceId: dto.serviceId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          startTime,
          endTime,
          channel: (dto.channel as AppointmentChannel) || 'WEB',
        },
      });

      // Record privacy consent (LFPDPPP)
      await tx.privacyConsent.create({
        data: {
          tenantId,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          consentType: 'booking',
        },
      });

      return appt;
    });

    // 4. Send confirmation email (fire and forget, outside transaction)
    if (dto.clientEmail) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      this.emailService.sendBookingConfirmation({
        clientName: dto.clientName,
        clientEmail: dto.clientEmail,
        serviceName: service.name,
        employeeName: employee.name,
        businessName: tenant?.name ?? '',
        date: startTime.toLocaleDateString('es-MX'),
        time: startTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        slug: tenant?.slug ?? '',
      });
    }

    return {
      id: appointment.id,
      employeeId: appointment.employeeId,
      serviceId: appointment.serviceId,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      clientEmail: appointment.clientEmail,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      status: appointment.status,
      channel: appointment.channel,
    };
  }
}
