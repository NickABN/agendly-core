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
