import type { AppointmentChannel, AppointmentStatus } from '../enums';

/**
 * Public booking flow contract (frontend public app /[slug] and admin manual booking).
 * `startTime` is always a UTC ISO-8601 instant with offset — never a zoneless string.
 */
export interface CreateBookingRequest {
  serviceId: string;
  employeeId: string;
  /** UTC ISO-8601 instant with `Z` (e.g. "2026-07-03T16:00:00.000Z") */
  startTime: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  channel?: AppointmentChannel;
}

export interface BookingResponse {
  id: string;
  employeeId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  /** UTC ISO instant */
  startTime: string;
  /** UTC ISO instant */
  endTime: string;
  status: AppointmentStatus;
  channel: AppointmentChannel;
}

export interface CheckAvailabilityRequest {
  tenantSlug: string;
  serviceId: string;
  /** Employee id, or "any" to search across every active employee offering the service */
  employeeId: string;
  /** Business-TZ calendar day, "YYYY-MM-DD" */
  date: string;
}
