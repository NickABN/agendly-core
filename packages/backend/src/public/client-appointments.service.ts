import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { formatDate, formatTime } from '@agendly/shared';
import type {
  AppointmentStatus as SharedStatus,
  ClientAppointmentDto,
} from '@agendly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AppointmentLinkService } from '../email/appointment-link.service';

const CLIENT_CANCEL_PREFIX = 'Cancelada por el cliente';

/**
 * Client self-service through the signed link in appointment emails: view the
 * appointment and cancel it while it is CONFIRMED and has not started.
 * An invalid or tampered token is indistinguishable from a missing appointment.
 */
@Injectable()
export class ClientAppointmentsService {
  private readonly logger = new Logger(ClientAppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly appointmentLinks: AppointmentLinkService,
  ) {}

  async findByToken(
    token: string,
    now: Date = new Date(),
  ): Promise<ClientAppointmentDto> {
    const appointment = await this.load(token);
    return {
      clientName: appointment.clientName,
      serviceName: appointment.service.name,
      employeeName: appointment.employee.name,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      status: appointment.status as SharedStatus,
      canCancel:
        appointment.status === 'CONFIRMED' && appointment.startTime > now,
      business: {
        name: appointment.tenant.name,
        slug: appointment.tenant.slug,
        timezone: appointment.tenant.timezone,
        phone: appointment.tenant.phone ?? null,
        address: appointment.tenant.address ?? null,
      },
    };
  }

  async cancel(
    token: string,
    reason?: string,
    now: Date = new Date(),
  ): Promise<ClientAppointmentDto> {
    const appointment = await this.load(token);

    // Atomic guard: a concurrent admin status change or the start time passing
    // between the read and the write must not be overwritten.
    const result = await this.prisma.appointment.updateMany({
      where: {
        id: appointment.id,
        status: 'CONFIRMED',
        startTime: { gt: now },
      },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason
          ? `${CLIENT_CANCEL_PREFIX}: ${reason}`
          : CLIENT_CANCEL_PREFIX,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('Esta cita ya no se puede cancelar');
    }

    this.notifyOwner(appointment, reason);
    return this.findByToken(token, now);
  }

  private async load(token: string) {
    const id = this.appointmentLinks.verify(token);
    const appointment = id
      ? await this.prisma.appointment.findUnique({
          where: { id },
          include: {
            employee: { select: { name: true } },
            service: { select: { name: true } },
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                timezone: true,
                phone: true,
                address: true,
              },
            },
          },
        })
      : null;
    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }
    return appointment;
  }

  /** Fire-and-forget email to the business owner, always with a logged catch. */
  private notifyOwner(
    appointment: Awaited<ReturnType<ClientAppointmentsService['load']>>,
    reason?: string,
  ): void {
    const { tenant } = appointment;
    void this.prisma.user
      .findFirst({
        where: { tenantId: tenant.id, role: 'OWNER', isActive: true },
        select: { email: true },
        orderBy: { createdAt: 'asc' },
      })
      .then((owner) => {
        if (!owner) return;
        return this.emailService.sendClientCancellationNotice({
          to: owner.email,
          businessName: tenant.name,
          clientName: appointment.clientName,
          clientPhone: appointment.clientPhone,
          serviceName: appointment.service.name,
          employeeName: appointment.employee.name,
          date: formatDate(appointment.startTime, 'long', tenant.timezone),
          time: formatTime(appointment.startTime, tenant.timezone),
          reason,
        });
      })
      .catch((err: Error) =>
        this.logger.error(
          `Fallo al avisar la cancelación del cliente: ${err.message}`,
        ),
      );
  }
}
