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

  async function createDefaultSchedule(employeeId: string) {
    return api.post<ScheduleResponse[]>(`/schedules/employee/${employeeId}/default`);
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
    createDefaultSchedule,
    getSchedules,
    completeOnboarding,
  };
}
