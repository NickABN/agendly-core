<script setup lang="ts">
definePageMeta({ layout: false });

const config = useRuntimeConfig();
const apiUrl = config.public.apiUrl;
const route = useRoute();

const token = computed(() => {
  const raw = route.query.token;
  return typeof raw === 'string' && raw.length > 0 ? raw : '';
});

const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);
const success = ref(false);
const errorMsg = ref('');

async function handleSubmit() {
  errorMsg.value = '';
  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Las contraseñas no coinciden';
    return;
  }
  loading.value = true;
  try {
    await $fetch(`${apiUrl}/auth/reset-password`, {
      method: 'POST',
      body: { token: token.value, password: password.value },
    });
    success.value = true;
  } catch (e: unknown) {
    // A 400 carries the backend's Spanish message (invalid/expired/used link).
    const err = e as { data?: { message?: string } };
    errorMsg.value = err.data?.message || 'No pudimos restablecer tu contraseña. Intenta de nuevo.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="bg-surface text-on-surface min-h-screen flex items-center justify-center p-6">
    <main class="w-full max-w-md">
      <div
        class="bg-surface-container-lowest rounded-2xl p-8 md:p-12 editorial-shadow border border-outline-variant/10 relative overflow-hidden"
      >
        <!-- Logo -->
        <div class="flex items-center justify-center mb-10">
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary"
            >
              <span class="material-symbols-outlined text-sm">lock_reset</span>
            </div>
            <span class="text-xl font-black tracking-tight text-primary">Agendly</span>
          </div>
        </div>

        <!-- Missing token state -->
        <div v-if="!token" class="text-center space-y-6">
          <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined text-red-600 text-4xl">link_off</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-on-surface mb-2 tracking-tight">Enlace inválido</h1>
            <p class="text-on-surface-variant text-sm leading-relaxed">
              Este enlace de recuperación no es válido. Solicita uno nuevo para restablecer tu
              contraseña.
            </p>
          </div>
          <NuxtLink
            to="/forgot-password"
            class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Solicitar un nuevo enlace
          </NuxtLink>
        </div>

        <!-- Success state -->
        <div v-else-if="success" class="text-center space-y-6">
          <div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
            <span
              class="material-symbols-outlined text-green-600 text-4xl"
              style="font-variation-settings: 'FILL' 1"
              >check_circle</span
            >
          </div>
          <div>
            <h1 class="text-2xl font-bold text-on-surface mb-2 tracking-tight">
              ¡Contraseña actualizada!
            </h1>
            <p class="text-on-surface-variant text-sm leading-relaxed">
              Tu contraseña se restableció correctamente. Ya puedes iniciar sesión con tu nueva
              contraseña.
            </p>
          </div>
          <NuxtLink
            to="/login"
            class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Ir al inicio de sesión
          </NuxtLink>
        </div>

        <!-- Form state -->
        <template v-else>
          <div class="mb-10 text-center">
            <h1 class="text-2xl font-bold text-on-surface mb-3 tracking-tight">
              Crea una nueva contraseña
            </h1>
            <p class="text-on-surface-variant text-sm leading-relaxed">
              Elige una contraseña nueva para tu cuenta. Debe tener al menos 8 caracteres.
            </p>
          </div>

          <!-- Error (client-side validation or backend 400) -->
          <div
            v-if="errorMsg"
            class="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
            role="alert"
          >
            <p>{{ errorMsg }}</p>
            <NuxtLink to="/forgot-password" class="font-semibold underline hover:text-red-800">
              Solicitar un nuevo enlace
            </NuxtLink>
          </div>

          <form class="space-y-6" @submit.prevent="handleSubmit">
            <div class="space-y-2">
              <label
                for="password"
                class="block text-xs font-semibold text-on-surface-variant uppercase tracking-widest ml-1"
              >
                Nueva contraseña
              </label>
              <div class="relative">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  minlength="8"
                  placeholder="Mínimo 8 caracteres"
                  class="block w-full pl-4 pr-12 py-4 bg-surface-container-high border-none rounded-xl text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-200 placeholder:text-outline"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant"
                  :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  @click="showPassword = !showPassword"
                >
                  <span class="material-symbols-outlined text-lg">{{
                    showPassword ? 'visibility_off' : 'visibility'
                  }}</span>
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <label
                for="confirmPassword"
                class="block text-xs font-semibold text-on-surface-variant uppercase tracking-widest ml-1"
              >
                Confirmar contraseña
              </label>
              <div class="relative">
                <input
                  id="confirmPassword"
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  required
                  minlength="8"
                  placeholder="Repite tu contraseña"
                  class="block w-full pl-4 pr-12 py-4 bg-surface-container-high border-none rounded-xl text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-200 placeholder:text-outline"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant"
                  :aria-label="showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <span class="material-symbols-outlined text-lg">{{
                    showConfirmPassword ? 'visibility_off' : 'visibility'
                  }}</span>
                </button>
              </div>
            </div>

            <div class="pt-2">
              <button
                type="submit"
                :disabled="loading"
                class="w-full py-4 px-6 soul-gradient text-on-primary font-bold rounded-full shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100"
              >
                <span>{{ loading ? 'Guardando...' : 'Restablecer contraseña' }}</span>
              </button>
            </div>
          </form>

          <div class="mt-10 pt-6 border-t border-surface-container text-center">
            <NuxtLink
              to="/login"
              class="inline-flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
            >
              <span class="material-symbols-outlined text-lg">chevron_left</span>
              <span>Volver al inicio de sesión</span>
            </NuxtLink>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
