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
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Crea tu cuenta gratis</h2>
      <p class="text-sm text-gray-500">14 días de prueba, sin tarjeta</p>
    </template>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <UAlert v-if="error" color="error" :title="error" />

      <UFormField label="Nombre de tu negocio">
        <UInput
          v-model="form.businessName"
          placeholder="Ej: Bellas Nails"
          required
          size="lg"
        />
      </UFormField>

      <UFormField label="Tu nombre">
        <UInput
          v-model="form.ownerName"
          placeholder="Ej: María López"
          required
          size="lg"
        />
      </UFormField>

      <UFormField label="Email">
        <UInput
          v-model="form.email"
          type="email"
          placeholder="tu@email.com"
          required
          size="lg"
        />
      </UFormField>

      <UFormField label="Contraseña">
        <UInput
          v-model="form.password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          required
          minlength="8"
          size="lg"
        />
      </UFormField>

      <UButton type="submit" block size="lg" :loading="loading">
        Crear cuenta
      </UButton>
    </form>

    <div class="my-4 flex items-center gap-3">
      <div class="h-px flex-1 bg-gray-200" />
      <span class="text-xs text-gray-400">o</span>
      <div class="h-px flex-1 bg-gray-200" />
    </div>

    <UButton
      block
      size="lg"
      variant="outline"
      icon="i-heroicons-globe-alt"
      @click="loginWithGoogle"
    >
      Continuar con Google
    </UButton>

    <template #footer>
      <p class="text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?
        <NuxtLink to="/login" class="text-primary font-medium">
          Inicia sesión
        </NuxtLink>
      </p>
    </template>
  </UCard>
</template>
