import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { AvailabilityService } from './availability.service';
import { zonedToUtc } from '@agendly/shared';
import type { CreateBookingDto } from './dto/create-booking.dto';

const TENANT_ID = 'tenant-1';
const FUTURE_DATE = '2030-06-10';
const futureStart = zonedToUtc(FUTURE_DATE, '10:00');

function buildDto(overrides: Partial<CreateBookingDto> = {}): CreateBookingDto {
  return {
    employeeId: 'emp-1',
    serviceId: 'svc-1',
    startTime: futureStart.toISOString(),
    clientName: 'Ana López',
    clientPhone: '5512345678',
    clientEmail: 'ana@example.com',
    ...overrides,
  } as CreateBookingDto;
}

describe('BookingService.createBooking', () => {
  let prisma: {
    service: { findFirst: jest.Mock };
    employee: { findFirst: jest.Mock };
    employeeService: { findFirst: jest.Mock };
    tenant: { findUnique: jest.Mock };
    appointment: { create: jest.Mock };
    privacyConsent: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let emailService: { sendBookingConfirmation: jest.Mock };
  let availabilityService: { getAvailableSlots: jest.Mock };
  let bookingService: BookingService;

  const serviceRow = {
    id: 'svc-1',
    tenantId: TENANT_ID,
    name: 'Corte',
    durationMinutes: 60,
    bufferMinutes: 0,
  };
  const employeeRow = { id: 'emp-1', tenantId: TENANT_ID, name: 'María' };
  const appointmentRow = {
    id: 'appt-1',
    employeeId: 'emp-1',
    serviceId: 'svc-1',
    clientName: 'Ana López',
    clientPhone: '5512345678',
    clientEmail: 'ana@example.com',
    startTime: futureStart,
    endTime: new Date(futureStart.getTime() + 60 * 60 * 1000),
    status: 'CONFIRMED',
    channel: 'WEB',
  };

  beforeEach(() => {
    prisma = {
      service: { findFirst: jest.fn().mockResolvedValue(serviceRow) },
      employee: { findFirst: jest.fn().mockResolvedValue(employeeRow) },
      employeeService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'es-1' }),
      },
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Salón', slug: 'salon' }),
      },
      appointment: {
        create: jest.fn().mockReturnValue(Promise.resolve(appointmentRow)),
      },
      privacyConsent: {
        create: jest.fn().mockReturnValue(Promise.resolve({})),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    emailService = {
      sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    availabilityService = {
      getAvailableSlots: jest.fn().mockResolvedValue([
        {
          start: futureStart.toISOString(),
          end: new Date(futureStart.getTime() + 60 * 60 * 1000).toISOString(),
        },
      ]),
    };

    bookingService = new BookingService(
      prisma as never,
      emailService as never,
      availabilityService as unknown as AvailabilityService,
    );
  });

  it('creates the booking and returns the real appointment id', async () => {
    const result = await bookingService.createBooking(TENANT_ID, buildDto());

    expect(result.id).toBe('appt-1');
    expect(result.startTime).toBe(futureStart.toISOString());
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.privacyConsent.create).toHaveBeenCalled();
  });

  it('rejects when the service does not exist or is inactive', async () => {
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(
      bookingService.createBooking(TENANT_ID, buildDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when the employee does not belong to the tenant or is inactive', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      bookingService.createBooking(TENANT_ID, buildDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when the employee does not offer the service', async () => {
    prisma.employeeService.findFirst.mockResolvedValue(null);

    await expect(
      bookingService.createBooking(TENANT_ID, buildDto()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects bookings in the past', async () => {
    const dto = buildDto({ startTime: '2020-01-01T16:00:00.000Z' });

    await expect(
      bookingService.createBooking(TENANT_ID, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects instants that are not one of the available slots (off-grid or taken)', async () => {
    const offGrid = new Date(futureStart.getTime() + 7 * 60 * 1000); // 10:07
    const dto = buildDto({ startTime: offGrid.toISOString() });

    await expect(
      bookingService.createBooking(TENANT_ID, dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps the DB exclusion-constraint violation to a 409', async () => {
    prisma.$transaction.mockRejectedValue(
      new Error(
        'conflicting key value violates exclusion constraint "appointment_no_overlap"',
      ),
    );

    await expect(
      bookingService.createBooking(TENANT_ID, buildDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not send email when clientEmail is missing', async () => {
    await bookingService.createBooking(
      TENANT_ID,
      buildDto({ clientEmail: undefined }),
    );

    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(emailService.sendBookingConfirmation).not.toHaveBeenCalled();
  });
});

describe('BookingService.createPublicBooking', () => {
  it('throws 404 for an unknown or inactive tenant slug', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new BookingService(
      prisma as never,
      null as never,
      null as never,
    );

    await expect(
      service.createPublicBooking('no-existe', buildDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
