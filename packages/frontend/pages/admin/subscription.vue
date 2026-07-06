<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const route = useRoute();
const billing = useBilling();

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  TRIALING: { label: 'Período de prueba', class: 'bg-blue-50 text-blue-700 border-blue-100' },
  ACTIVE: { label: 'Activa', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  PAST_DUE: { label: 'Pago pendiente', class: 'bg-amber-50 text-amber-700 border-amber-100' },
  CANCELED: { label: 'Cancelada', class: 'bg-red-50 text-red-700 border-red-100' },
  INCOMPLETE: { label: 'Incompleta', class: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const checkoutResult = computed(() => route.query.checkout as string | undefined);
const isSubscribed = computed(
  () => billing.status.value?.subscriptionStatus === 'ACTIVE' ||
    billing.status.value?.subscriptionStatus === 'PAST_DUE',
);

onMounted(() => billing.loadStatus());
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="flex items-center gap-4 px-4 md:px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0">
      <h1 class="text-lg font-bold tracking-tight">Suscripción</h1>
    </header>

    <div class="flex-1 overflow-y-auto p-4 md:p-8">
      <div class="max-w-2xl mx-auto w-full space-y-6">
        <!-- Retorno del checkout -->
        <div v-if="checkoutResult === 'success'" class="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <span class="material-symbols-outlined text-emerald-600" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check_circle</span>
          <p class="text-sm font-semibold text-emerald-700">¡Pago procesado! Tu suscripción se está activando.</p>
        </div>
        <div v-else-if="checkoutResult === 'cancel'" class="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
          <span class="material-symbols-outlined text-amber-600" aria-hidden="true">info</span>
          <p class="text-sm text-amber-700">Cancelaste el pago. Puedes suscribirte cuando quieras.</p>
        </div>

        <div v-if="billing.error.value" class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100" role="alert">
          <span class="material-symbols-outlined text-red-500 text-lg" aria-hidden="true">error</span>
          <p class="text-sm text-red-700">{{ billing.error.value }}</p>
        </div>

        <!-- Loading -->
        <div v-if="billing.pending.value && !billing.status.value" class="flex items-center justify-center py-16" role="status">
          <div class="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" aria-hidden="true"></div>
        </div>

        <template v-else-if="billing.status.value">
          <!-- Estado actual -->
          <section class="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-outline-variant)]/10">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold text-[var(--color-on-surface)]">Plan Profesional</h2>
              <span class="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border" :class="STATUS_LABEL[billing.status.value.subscriptionStatus]?.class">
                {{ STATUS_LABEL[billing.status.value.subscriptionStatus]?.label }}
              </span>
            </div>

            <p v-if="billing.status.value.subscriptionStatus === 'TRIALING'" class="text-sm text-[var(--color-on-surface-variant)] mb-6">
              Te quedan <strong>{{ billing.status.value.trialDaysRemaining }}</strong> días de prueba gratuita.
            </p>
            <p v-else-if="isSubscribed && billing.status.value.currentPeriodEnd" class="text-sm text-[var(--color-on-surface-variant)] mb-6">
              Tu suscripción se renueva el
              <strong>{{ new Date(billing.status.value.currentPeriodEnd).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }}</strong>.
            </p>
            <p v-else class="text-sm text-[var(--color-on-surface-variant)] mb-6">
              Tu período de prueba terminó. Suscríbete para seguir recibiendo reservas.
            </p>

            <!-- Sin Stripe configurado (PoC) -->
            <div v-if="!billing.status.value.configured" class="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-[var(--color-on-surface-variant)]">
              <span class="material-symbols-outlined text-lg" aria-hidden="true">construction</span>
              Los pagos aún no están configurados en este entorno. Contáctanos para activar tu cuenta.
            </div>

            <div v-else class="flex flex-col sm:flex-row gap-3">
              <button
                v-if="!isSubscribed"
                :disabled="billing.redirecting.value"
                class="flex-1 soul-gradient text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                @click="billing.subscribe"
              >
                <div v-if="billing.redirecting.value" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></div>
                Suscribirme
              </button>
              <button
                v-else
                :disabled="billing.redirecting.value"
                class="flex-1 bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] py-3 rounded-xl font-semibold hover:bg-[var(--color-surface-container-highest)] transition-all disabled:opacity-50"
                @click="billing.openPortal"
              >
                Gestionar suscripción
              </button>
            </div>
          </section>

          <p class="text-xs text-center text-[var(--color-outline)]">
            Pagos procesados de forma segura por Stripe. Puedes cancelar cuando quieras.
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
