<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const { login, loginWithGoogle } = useAuth();

const form = reactive({
  email: '',
  password: '',
});
const loading = ref(false);
const error = ref('');

async function handleSubmit() {
  loading.value = true;
  error.value = '';
  try {
    await login(form);
    navigateTo('/admin');
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err.data?.message || 'Error al iniciar sesión';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">Iniciar sesión</h2>
    </template>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <UAlert v-if="error" color="error" :title="error" />

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
          placeholder="Tu contraseña"
          required
          size="lg"
        />
      </UFormField>

      <UButton type="submit" block size="lg" :loading="loading">
        Entrar
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
        ¿No tienes cuenta?
        <NuxtLink to="/register" class="text-primary font-medium">
          Regístrate gratis
        </NuxtLink>
      </p>
    </template>
  </UCard>
</template>
