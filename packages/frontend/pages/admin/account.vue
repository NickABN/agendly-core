<script setup lang="ts">
import { ACCOUNT_DELETION_GRACE_DAYS, formatDate } from '@agendly/shared';

definePageMeta({ layout: 'admin' });

const { store, logout } = useAuth();
const timezone = useBusinessTimezone();
const { status, loading, error, load, requestDeletion, cancelDeletion } = useAccountDeletion();

const isOwner = computed(() => store.user?.role === 'OWNER');
const slug = computed(() => store.tenant?.slug ?? '');
const pendingDate = computed(() =>
  store.deletionScheduledAt ? formatDate(store.deletionScheduledAt, 'long', timezone.value) : '',
);

const confirming = ref(false);
const confirmSlug = ref('');
const password = ref('');
const reactivated = ref(false);

const canSubmit = computed(
  () =>
    confirmSlug.value.trim().toLowerCase() === slug.value &&
    (!status.value?.requiresPassword || password.value.length > 0),
);

async function submitDeletion() {
  const ok = await requestDeletion({
    confirmSlug: confirmSlug.value,
    password: status.value?.requiresPassword ? password.value : undefined,
  });
  if (ok) {
    confirming.value = false;
    confirmSlug.value = '';
    password.value = '';
  }
}

async function reactivate() {
  reactivated.value = await cancelDeletion();
}

onMounted(() => void load());
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header
      class="flex items-center gap-4 px-4 md:px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
    >
      <h1 class="text-lg font-bold tracking-tight">Cuenta</h1>
    </header>

    <div class="flex-1 overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">
      <!-- Deletion pending -->
      <section
        v-if="store.deletionScheduledAt"
        class="rounded-xl p-5 md:p-6 bg-red-50 border border-red-200 space-y-4"
      >
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-red-600" aria-hidden="true">auto_delete</span>
          <div>
            <h2 class="text-base font-bold text-red-800">Tu cuenta se eliminará pronto</h2>
            <p class="text-sm text-red-700 mt-1">
              <strong>{{ store.tenant?.name }}</strong> está desactivado: tu página de reservas no
              recibe citas. El <strong>{{ pendingDate }}</strong> borraremos de forma definitiva el
              negocio, su personal, servicios, citas y datos de clientes.
            </p>
          </div>
        </div>
        <p v-if="error" class="text-sm text-red-700 font-semibold" role="alert">{{ error }}</p>
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            v-if="isOwner"
            class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-50"
            :disabled="loading"
            @click="reactivate"
          >
            {{ loading ? 'Reactivando...' : 'Reactivar mi cuenta' }}
          </button>
          <p v-else class="text-sm text-red-700">Solo el dueño de la cuenta puede reactivarla.</p>
          <button
            class="px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 rounded-xl transition-colors"
            @click="logout"
          >
            Cerrar sesión
          </button>
        </div>
      </section>

      <template v-else>
        <div
          v-if="reactivated"
          class="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100"
          role="status"
        >
          <span class="material-symbols-outlined text-emerald-600" aria-hidden="true"
            >check_circle</span
          >
          <p class="text-sm font-semibold text-emerald-700">
            Tu cuenta está activa de nuevo.
            <NuxtLink to="/admin" class="underline">Ir a la agenda</NuxtLink>
          </p>
        </div>

        <section
          class="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 md:p-6 editorial-shadow border border-[var(--color-outline-variant)]/10"
        >
          <h2 class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider mb-4">
            Tu cuenta
          </h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="text-[var(--color-on-surface-variant)]">Negocio</dt>
              <dd class="font-semibold">{{ store.tenant?.name }}</dd>
            </div>
            <div>
              <dt class="text-[var(--color-on-surface-variant)]">Correo</dt>
              <dd class="font-semibold break-all">{{ store.user?.email }}</dd>
            </div>
          </dl>
        </section>

        <!-- Danger zone -->
        <section class="rounded-xl p-5 md:p-6 border border-red-200 bg-white space-y-4">
          <div>
            <h2 class="text-sm font-bold text-red-700 uppercase tracking-wider mb-2">
              Eliminar cuenta
            </h2>
            <p class="text-sm text-[var(--color-on-surface-variant)]">
              Tu página de reservas se desactiva de inmediato. Tendrás
              {{ ACCOUNT_DELETION_GRACE_DAYS }} días para arrepentirte; después borraremos de forma
              definitiva el negocio, su personal, servicios, citas, datos de clientes e imágenes.
            </p>
          </div>

          <p v-if="!isOwner" class="text-sm text-[var(--color-on-surface-variant)]">
            Solo el dueño de la cuenta puede eliminarla.
          </p>

          <template v-else-if="!confirming">
            <button
              class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 transition-colors"
              @click="confirming = true"
            >
              Eliminar mi cuenta
            </button>
          </template>

          <form v-else class="space-y-4" @submit.prevent="submitDeletion">
            <div
              v-if="status && status.upcomingAppointments > 0"
              class="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200"
            >
              <span class="material-symbols-outlined text-amber-600 text-lg" aria-hidden="true"
                >warning</span
              >
              <p class="text-sm text-amber-800">
                Tienes <strong>{{ status.upcomingAppointments }}</strong>
                {{ status.upcomingAppointments === 1 ? 'cita próxima' : 'citas próximas' }}. No las
                cancelaremos ni avisaremos a tus clientes: cancélalas o avísales antes.
              </p>
            </div>

            <div>
              <label
                for="confirm-slug"
                class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5"
                >Escribe <span class="font-mono normal-case">{{ slug }}</span> para confirmar</label
              >
              <input
                id="confirm-slug"
                v-model="confirmSlug"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm font-mono focus:ring-2 focus:ring-red-200 focus:bg-white transition-all outline-none"
              />
            </div>
            <div v-if="status?.requiresPassword">
              <label
                for="confirm-password"
                class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5"
                >Tu contraseña</label
              >
              <input
                id="confirm-password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-red-200 focus:bg-white transition-all outline-none"
              />
            </div>

            <p
              v-if="error"
              class="text-sm text-red-700 p-3 rounded-xl bg-red-50 border border-red-100"
              role="alert"
            >
              {{ error }}
            </p>

            <div class="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                class="px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-slate-100 rounded-xl transition-colors"
                :disabled="loading"
                @click="confirming = false"
              >
                Conservar mi cuenta
              </button>
              <button
                type="submit"
                class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40"
                :disabled="loading || !canSubmit"
              >
                {{ loading ? 'Programando...' : `Eliminar en ${ACCOUNT_DELETION_GRACE_DAYS} días` }}
              </button>
            </div>
          </form>
        </section>
      </template>
    </div>
  </div>
</template>
