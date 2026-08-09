import { DayOfWeek } from '@agendly/shared';
import { useAuthStore } from '~/stores/auth';

interface ServiceForm {
  name: string;
  durationMinutes: number;
  priceMXN: number;
}

interface EmployeeForm {
  name: string;
  serviceIds: string[];
}

interface ServiceResponse {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMXN: string;
  isActive: boolean;
}

interface EmployeeResponse {
  id: string;
  name: string;
  isActive: boolean;
  serviceIds: string[];
}

interface ScheduleResponse {
  id: string;
  employeeId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface WeekDayScheduleForm {
  enabled: boolean;
  start: string;
  end: string;
}

/** Monday-first order matching the rows of the onboarding weekly editor. */
const WEEK_DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  onboardedAt: string | null;
  trialEndsAt: string;
  isActive: boolean;
}

export function useOnboarding() {
  const api = useApi();
  const authStore = useAuthStore();

  async function updateTenant(data: { name?: string; slug?: string }) {
    return api.patch<TenantResponse>('/tenant', data);
  }

  async function createServices(services: ServiceForm[]) {
    return api.post<ServiceResponse[]>('/services/batch', services);
  }

  async function getServices() {
    return api.get<ServiceResponse[]>('/services');
  }

  async function createEmployees(employees: EmployeeForm[]) {
    return api.post<EmployeeResponse[]>('/employees/batch', employees);
  }

  async function getEmployees() {
    return api.get<EmployeeResponse[]>('/employees');
  }

  /**
   * Replaces each employee's weekly schedule with the hours edited in step 4.
   * PUT /schedules/bulk is a full replace per employee, so disabled days are
   * simply omitted and stay closed.
   */
  async function saveSchedules(employeeIds: string[], weekDays: WeekDayScheduleForm[]) {
    const days = weekDays
      .map((day, index) => ({ ...day, dayOfWeek: WEEK_DAY_ORDER[index] }))
      .filter((day) => day.enabled)
      .map((day) => ({ dayOfWeek: day.dayOfWeek, startTime: day.start, endTime: day.end }));

    for (const employeeId of employeeIds) {
      await api.put<ScheduleResponse[]>('/schedules/bulk', { employeeId, days });
    }
  }

  async function getSchedules() {
    return api.get<ScheduleResponse[]>('/schedules');
  }

  async function completeOnboarding() {
    const tenant = await api.post<TenantResponse>('/tenant/complete-onboarding');
    authStore.setTenant({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      onboardedAt: tenant.onboardedAt,
      trialEndsAt: tenant.trialEndsAt,
      isActive: tenant.isActive,
    });
    return tenant;
  }

  return {
    updateTenant,
    createServices,
    getServices,
    createEmployees,
    getEmployees,
    saveSchedules,
    getSchedules,
    completeOnboarding,
  };
}
