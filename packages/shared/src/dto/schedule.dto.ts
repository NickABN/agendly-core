import type { DayOfWeek } from '../enums';

export interface ScheduleDto {
  id: string;
  employeeId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface CreateScheduleDto {
  employeeId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface UpdateScheduleDto {
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

export interface ScheduleExceptionDto {
  id: string;
  employeeId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

export interface CreateScheduleExceptionDto {
  employeeId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}
