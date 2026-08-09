import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AvailabilityService } from './availability.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { formatDate, formatTime, isPast, utcToDateKey } from '@agendly/shared';
import { hasActiveAccess } from '../common/subscription-access';
import type {
  AppointmentChannel as SharedChannel,
  AppointmentStatus as SharedStatus,
  BookingResponse,
} from '@agendly/shared';
import type { AppointmentChannel } from '../generated/prisma/client.js';

/** Tenant fields the booking flow needs (timezone drives all slot math). */
interface TenantContext {
  id: string;
  name: string;
  slug: string;
  timezone: string;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /** Public booking: resolves the tenant by slug first. */
  async createPublicBooking(
    tenantSlug: string,
    dto: CreateBookingDto,
    clientIp?: string,
  ): Promise<BookingResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant || !hasActiveAccess(tenant)) {
      throw new NotFoundException('Negocio no encontrado');
    }
    return this.createBookingForTenant(tenant, dto, clientIp);
  }

  /** Admin/manual booking: loads the tenant once (timezone, email data). */
  async createBooking(
    tenantId: string,
    dto: CreateBookingDto,
    clientIp?: string,
  ): Promise<BookingResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado');
    }
    return this.createBookingForTenant(tenant, dto, clientIp);
  }

  private async createBookingForTenant(
    tenant: TenantContext,
    dto: CreateBookingDto,
    clientIp?: string,
  ): Promise<BookingResponse> {
    const tenantId = tenant.id;

    // 1. Service and employee must exist, belong to the tenant, and be active
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId, deletedAt: null, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null, isActive: true },
    });
    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const offersService = await this.prisma.employeeService.findFirst({
      where: { employeeId: dto.employeeId, serviceId: dto.serviceId },
    });
    if (!offersService) {
      throw new BadRequestException(
        'El empleado seleccionado no ofrece este servicio',
      );
    }

    // 2. The requested instant must be a legitimate slot: in the future and
    //    exactly one of the currently available slots (this subsumes working
    //    hours, exceptions, slot alignment, and service availability windows).
    const startTime = new Date(dto.startTime); // DTO guarantees an offset-bearing ISO string
    if (isPast(startTime)) {
      throw new BadRequestException(
        'No se puede reservar un horario en el pasado',
      );
    }

    const requestedStart = startTime.toISOString();
    const daySlots = await this.availabilityService.getAvailableSlots({
      tenantId,
      employeeId: dto.employeeId,
      serviceId: dto.serviceId,
      date: utcToDateKey(startTime, tenant.timezone),
      serviceDurationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      timezone: tenant.timezone,
    });
    if (!daySlots.some((slot) => slot.start === requestedStart)) {
      throw new ConflictException('Este horario ya no está disponible');
    }

    const endTime = new Date(
      startTime.getTime() + service.durationMinutes * 60 * 1000,
    );

    // 3. Create appointment + privacy consent atomically. The DB exclusion
    //    constraint (appointment_no_overlap) is the real anti-double-booking
    //    guarantee under concurrency.
    let appointment;
    try {
      [appointment] = await this.prisma.$transaction([
        this.prisma.appointment.create({
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
        }),
        // Record privacy consent (LFPDPPP) — con IP como evidencia de origen
        this.prisma.privacyConsent.create({
          data: {
            tenantId,
            clientPhone: dto.clientPhone,
            clientEmail: dto.clientEmail,
            consentType: 'booking',
            ipAddress: clientIp ?? null,
          },
        }),
      ]);
    } catch (err) {
      if (isNoOverlapViolation(err)) {
        throw new ConflictException('Este horario ya está ocupado');
      }
      throw err;
    }

    this.sendConfirmationEmail(
      tenant,
      dto,
      service.name,
      employee.name,
      startTime,
    );

    return {
      id: appointment.id,
      employeeId: appointment.employeeId,
      serviceId: appointment.serviceId,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      clientEmail: appointment.clientEmail,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      // Prisma enum literals and shared enums share the same string values
      status: appointment.status as SharedStatus,
      channel: appointment.channel as SharedChannel,
    };
  }

  /** Fire-and-forget, outside the transaction, always with a logged catch. */
  private sendConfirmationEmail(
    tenant: TenantContext,
    dto: CreateBookingDto,
    serviceName: string,
    employeeName: string,
    startTime: Date,
  ): void {
    if (!dto.clientEmail) return;

    void this.emailService
      .sendBookingConfirmation({
        clientName: dto.clientName,
        clientEmail: dto.clientEmail,
        serviceName,
        employeeName,
        businessName: tenant.name,
        date: formatDate(startTime, 'long', tenant.timezone),
        time: formatTime(startTime, tenant.timezone),
        slug: tenant.slug,
      })
      .catch((err: Error) =>
        this.logger.error(
          `Fallo al enviar confirmación de reserva: ${err.message}`,
        ),
      );
  }
}

/** Postgres exclusion-constraint violation (23P01) on appointment_no_overlap. */
function isNoOverlapViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('appointment_no_overlap') || message.includes('23P01')
  );
}
