import type { AppointmentStatus, AppointmentChannel } from '../enums';

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
  start: string;
  end: string;
}
