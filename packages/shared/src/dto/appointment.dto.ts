import type { AppointmentStatus, AppointmentChannel } from '../enums';
import type { NoShowRiskDto } from './insights.dto';

export interface AppointmentDto {
  id: string;
  employeeId: string;
  employeeName: string;
  serviceId: string;
  serviceName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  channel: AppointmentChannel;
  cancellationReason: string | null;
  /** Present on upcoming CONFIRMED appointments in calendar reads. */
  noShowRisk?: NoShowRiskDto | null;
}

export interface CreateAppointmentDto {
  employeeId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  startTime: string;
  channel?: AppointmentChannel;
}

export interface TimeSlotDto {
  /** UTC ISO instant */
  start: string;
  /** UTC ISO instant */
  end: string;
  /** Present when slots were searched across employees ("any available") */
  employeeId?: string;
}

/** Density map returned by GET /appointments/month, keyed by business-TZ date key. */
export type MonthDensityResponse = Record<string, { count: number; employees: string[] }>;

/** Day/week calendar reads return arrays of full appointments. */
export type DayAppointmentsResponse = AppointmentDto[];
export type WeekAppointmentsResponse = AppointmentDto[];

/** PATCH /appointments/:id/reschedule */
export interface RescheduleRequest {
  /** UTC ISO instant of one of the slots from GET /appointments/:id/reschedule-slots */
  startTime: string;
  /** Optional new employee (defaults to the current one) */
  employeeId?: string;
}

export interface RescheduleResponse {
  id: string;
  employeeId: string;
  /** UTC ISO instant */
  startTime: string;
  /** UTC ISO instant */
  endTime: string;
}

/**
 * Client self-service view (GET /public/appointments/:token), reached through the
 * signed link in the confirmation, reschedule and reminder emails.
 */
export interface ClientAppointmentDto {
  clientName: string;
  serviceName: string;
  employeeName: string;
  /** UTC ISO instant */
  startTime: string;
  /** UTC ISO instant */
  endTime: string;
  status: AppointmentStatus;
  /** CONFIRMED and not started yet */
  canCancel: boolean;
  business: {
    name: string;
    slug: string;
    timezone: string;
    phone: string | null;
    address: string | null;
  };
}

/** POST /public/appointments/:token/cancel */
export interface ClientCancelRequest {
  reason?: string;
}
