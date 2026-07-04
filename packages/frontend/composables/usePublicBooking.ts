import { computed, reactive, ref, watch } from 'vue';
import type {
  BookingResponse,
  CreateBookingRequest,
  PublicTenantResponse,
} from '@agendly/shared';

/**
 * Full state machine of the public booking flow (agendly.mx/[slug]):
 * steps, selections, slot search, submit with 409 recovery, confirmation data.
 */
export async function usePublicBooking(slug: string) {
  const config = useRuntimeConfig();
  const apiUrl = config.public.apiUrl;

  // Nuxt-instance-dependent composables MUST run before the first await:
  // after an await boundary the instance context is gone.
  const { slots, loading: loadingSlots, fetchSlots, reset: resetSlots } = useAvailability();

  // ── Tenant payload (SSR) ──
  const { data: tenantData, error: fetchError } = await useAsyncData(`public-${slug}`, () =>
    $fetch<PublicTenantResponse>(`${apiUrl}/public/${slug}`),
  );

  const tenantName = computed(() => tenantData.value?.tenant.name ?? '');
  const services = computed(() => tenantData.value?.services ?? []);
  const employees = computed(() => tenantData.value?.employees ?? []);

  // ── Flow state ──
  const step = ref(1); // 1=service, 2=employee, 3=date+time, 4=client info
  const submitting = ref(false);
  const error = ref('');
  const confirmation = ref<BookingResponse | null>(null);

  const selectedServiceId = ref('');
  const selectedEmployeeId = ref('');
  const selectedDate = ref('');
  const selectedSlot = ref('');

  const clientForm = reactive({
    name: '',
    phone: '',
    email: '',
    privacyAccepted: false,
  });

  // ── Derived ──
  const filteredEmployees = computed(() => {
    if (!selectedServiceId.value) return [];
    return employees.value.filter((e) => e.serviceIds.includes(selectedServiceId.value));
  });

  const selectedService = computed(() =>
    services.value.find((s) => s.id === selectedServiceId.value),
  );

  const selectedEmployeeName = computed(() => {
    if (selectedEmployeeId.value === 'any') return 'Cualquier disponible';
    return employees.value.find((e) => e.id === selectedEmployeeId.value)?.name ?? '';
  });

  /** The backend resolves "any" server-side: each slot carries its real employeeId. */
  const selectedSlotEmployeeId = computed(() => {
    const slot = slots.value.find((s) => s.start === selectedSlot.value);
    return slot?.employeeId ?? selectedEmployeeId.value;
  });

  // ── Actions ──
  function loadSlots() {
    if (!selectedEmployeeId.value || !selectedDate.value || !selectedServiceId.value) return;
    selectedSlot.value = '';
    void fetchSlots({
      tenantSlug: slug,
      employeeId: selectedEmployeeId.value,
      serviceId: selectedServiceId.value,
      date: selectedDate.value,
    });
  }

  watch([selectedEmployeeId, selectedDate], loadSlots);

  function selectService(id: string) {
    selectedServiceId.value = id;
    selectedEmployeeId.value = '';
    selectedDate.value = '';
    selectedSlot.value = '';
    resetSlots();

    const available = employees.value.filter((e) => e.serviceIds.includes(id));
    if (available.length === 1) {
      selectedEmployeeId.value = available[0].id;
      step.value = 3; // skip employee step
    } else {
      step.value = 2;
    }
  }

  function selectEmployee(id: string) {
    selectedEmployeeId.value = id;
    selectedDate.value = '';
    selectedSlot.value = '';
    resetSlots();
    step.value = 3;
  }

  function goToClientForm() {
    if (!selectedSlot.value) return;
    step.value = 4;
  }

  async function submitBooking() {
    if (!clientForm.privacyAccepted) {
      error.value = 'Debes aceptar el aviso de privacidad';
      return;
    }
    submitting.value = true;
    error.value = '';
    try {
      const body: CreateBookingRequest = {
        employeeId: selectedSlotEmployeeId.value,
        serviceId: selectedServiceId.value,
        startTime: selectedSlot.value,
        clientName: clientForm.name.trim(),
        clientPhone: clientForm.phone.trim(),
        clientEmail: clientForm.email.trim() || undefined,
      };
      confirmation.value = await $fetch<BookingResponse>(
        `${apiUrl}/availability/book?tenantSlug=${slug}`,
        { method: 'POST', body },
      );
    } catch (e: unknown) {
      const err = e as { statusCode?: number; status?: number; data?: { message?: string | string[] } };
      const status = err.statusCode ?? err.status;
      const message = err.data?.message;
      const text = (Array.isArray(message) ? message[0] : message) || 'Error al crear la cita';

      if (status === 409) {
        // Slot taken between selection and submit: refresh slots and send the
        // user back to pick another time instead of leaving them stranded.
        error.value = `${text}. Elige otro horario disponible.`;
        step.value = 3;
        loadSlots();
      } else {
        error.value = text;
      }
    } finally {
      submitting.value = false;
    }
  }

  return {
    tenantData,
    fetchError,
    tenantName,
    services,
    employees,
    step,
    submitting,
    error,
    confirmation,
    selectedServiceId,
    selectedEmployeeId,
    selectedDate,
    selectedSlot,
    clientForm,
    slots,
    loadingSlots,
    filteredEmployees,
    selectedService,
    selectedEmployeeName,
    selectService,
    selectEmployee,
    goToClientForm,
    submitBooking,
  };
}
