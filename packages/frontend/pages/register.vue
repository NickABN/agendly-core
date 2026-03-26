<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const { register, loginWithGoogle } = useAuth();

const form = reactive({
  businessName: '',
  ownerName: '',
  email: '',
  password: '',
});
const loading = ref(false);
const error = ref('');
const showPassword = ref(false);

async function handleSubmit() {
  loading.value = true;
  error.value = '';
  try {
    await register(form);
    navigateTo('/onboarding');
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err.data?.message || 'Error al crear la cuenta';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-8">
    <header class="text-center lg:text-left">
      <h1 class="text-3xl font-semibold tracking-tight mb-2">Comienza tu viaje</h1>
      <p class="text-[var(--color-on-surface-variant)]">Crea tu cuenta y transforma la gestión de tu negocio.</p>
    </header>

    <!-- Google OAuth -->
    <button
      type="button"
      class="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)] hover:bg-[var(--color-surface-container-low,#f3f4f5)] transition-all duration-200"
      @click="loginWithGoogle"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      <span class="font-medium">Registrarse con Google</span>
    </button>

    <!-- Divider -->
    <div class="relative flex items-center py-2">
      <div class="flex-grow border-t border-[var(--color-outline-variant)]/30"></div>
      <span class="flex-shrink mx-4 text-xs font-medium uppercase tracking-widest text-[var(--color-outline)]">O con tu correo</span>
      <div class="flex-grow border-t border-[var(--color-outline-variant)]/30"></div>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      {{ error }}
    </div>

    <!-- Form -->
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label for="ownerName" class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
            Tu nombre
          </label>
          <input
            id="ownerName"
            v-model="form.ownerName"
            type="text"
            required
            placeholder="Ej. María"
            class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]"
          />
        </div>
        <div class="space-y-2">
          <label for="businessName" class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
            Nombre del negocio
          </label>
          <input
            id="businessName"
            v-model="form.businessName"
            type="text"
            required
            placeholder="Ej. Bellas Nails"
            class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]"
          />
        </div>
      </div>

      <div class="space-y-2">
        <label for="email" class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
          Correo electrónico
        </label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          required
          placeholder="hola@tunegocio.com"
          class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]"
        />
      </div>

      <div class="space-y-2">
        <label for="password" class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
          Contraseña
        </label>
        <div class="relative">
          <input
            id="password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            required
            minlength="8"
            placeholder="Mínimo 8 caracteres"
            class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-outline)] hover:text-[var(--color-on-surface-variant)]"
            @click="showPassword = !showPassword"
          >
            <span class="material-symbols-outlined text-lg">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
          </button>
        </div>
      </div>

      <div class="pt-4">
        <button
          type="submit"
          :disabled="loading"
          class="w-full soul-gradient text-white py-4 rounded-lg font-semibold shadow-xl shadow-[var(--color-primary)]/10 hover:shadow-[var(--color-primary)]/20 hover:scale-[1.01] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Creando cuenta...' : 'Crear mi cuenta' }}
        </button>
      </div>
    </form>

    <p class="text-center text-sm text-[var(--color-on-surface-variant)]">
      ¿Ya tienes una cuenta?
      <NuxtLink to="/login" class="text-[var(--color-primary)] font-bold hover:underline">
        Inicia sesión
      </NuxtLink>
    </p>

    <footer class="pt-4 text-center">
      <p class="text-[10px] text-[var(--color-outline)] uppercase tracking-widest leading-relaxed">
        Al registrarte, aceptas nuestros<br />
        <NuxtLink to="/privacidad" class="underline hover:text-[var(--color-primary)]">Términos de Servicio</NuxtLink>
        y
        <NuxtLink to="/privacidad" class="underline hover:text-[var(--color-primary)]">Política de Privacidad</NuxtLink>.
      </p>
    </footer>
  </div>
</template>
