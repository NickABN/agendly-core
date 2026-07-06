<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const { store, logout } = useAuth();

const nav = useCalendarNav();
const calendar = useAppointmentsCalendar(nav);

const showManualForm = ref(false);

const headerLabel = computed(() => {
  if (nav.view.value === 'day') return nav.dayLabel.value;
  if (nav.view.value === 'week') return nav.weekLabel.value;
  return nav.monthLabel.value;
});

const tenantSlug = computed(() => store.tenant?.slug ?? '');

async function onUpdateStatus(id: string, status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED') {
  await calendar.updateStatus(id, status);
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <CalendarHeader
      v-model:view="nav.view.value"
      :label="headerLabel"
      :is-today="nav.isToday.value"
      @prev="nav.prev"
      @next="nav.next"
      @today="nav.goToToday"
      @new-appointment="showManualForm = true"
      @logout="logout"
    />

    <!-- Screen-reader announcement for polling refreshes -->
    <p class="sr-only" role="status" aria-live="polite">{{ calendar.announcement.value }}</p>

    <div class="flex-1 overflow-y-auto p-3 md:p-6">
      <!-- Trial por vencer (últimos 7 días) -->
      <div
        v-if="store.hasAccess && store.trialDaysRemaining > 0 && store.trialDaysRemaining <= 7"
        class="mb-6 flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200"
      >
        <span class="material-symbols-outlined text-amber-600" aria-hidden="true">schedule</span>
        <p class="text-sm text-amber-700">
          Te quedan <strong>{{ store.trialDaysRemaining }}</strong> días de prueba.
          <NuxtLink to="/admin/subscription" class="font-bold underline ml-1">Suscribirme →</NuxtLink>
        </p>
      </div>
      <!-- Sin acceso vigente (prueba vencida sin pago) -->
      <div
        v-else-if="!store.hasAccess"
        class="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200"
      >
        <span class="material-symbols-outlined text-red-600" aria-hidden="true">lock</span>
        <p class="text-sm text-red-700">
          Tu período de prueba terminó. Suscríbete para volver a recibir reservas.
          <NuxtLink to="/admin/subscription" class="font-bold underline ml-1">Suscribirme →</NuxtLink>
        </p>
      </div>

      <!-- Fetch error -->
      <div v-if="calendar.error.value" class="mb-6 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
        <span class="material-symbols-outlined text-red-500 text-lg" aria-hidden="true">error</span>
        <p class="text-sm text-red-700">{{ calendar.error.value }}</p>
      </div>

      <CalendarDayView
        v-if="nav.view.value === 'day'"
        :appointments="calendar.dayAppointments.value"
        :loading="calendar.loading.value"
        :is-today="nav.isToday.value"
        :slug="tenantSlug"
        @update-status="onUpdateStatus"
      />

      <CalendarWeekView
        v-else-if="nav.view.value === 'week'"
        :week-days="nav.weekDays.value"
        :appointments-by-date="calendar.weekByDate.value"
        :loading="calendar.loading.value"
        @select-day="nav.goToDay"
      />

      <CalendarMonthView
        v-else
        :month-days="nav.monthDays.value"
        :density="calendar.monthDensity.value"
        :loading="calendar.loading.value"
        @go-to-day="nav.goToDay"
      />
    </div>

    <CalendarManualBookingModal
      v-model:open="showManualForm"
      :tenant-slug="tenantSlug"
      :default-date="nav.selectedDate.value"
      @created="calendar.refresh"
    />
  </div>
</template>
