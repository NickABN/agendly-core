<template>
  <div
    class="bg-surface text-on-surface min-h-screen flex items-center justify-center p-6 overflow-hidden"
  >
    <!-- Decorative background blobs -->
    <div
      class="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-100/40 blur-[100px] -z-10 pointer-events-none"
    ></div>
    <div
      class="fixed bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-teal-50/40 blur-[100px] -z-10 pointer-events-none"
    ></div>

    <main class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <!-- Left: Brand & visual context -->
      <div class="hidden lg:flex lg:col-span-7 flex-col space-y-8 pr-12">
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary"
            >
              <span class="material-symbols-outlined">lock_reset</span>
            </div>
            <span class="text-2xl font-black tracking-tight text-primary">Agendly</span>
          </div>
          <h1 class="text-5xl font-extrabold tracking-tight text-on-surface leading-[1.1]">
            Calma Operativa<br />
            <span class="text-primary-container">Comienza con Seguridad.</span>
          </h1>
          <p class="text-lg text-on-surface-variant max-w-md leading-relaxed">
            Nuestro sistema garantiza que tus datos estén protegidos mientras te enfocas en lo que
            más importa: tu tiempo.
          </p>
        </div>

        <!-- Tip card -->
        <div class="relative group">
          <div
            class="absolute -inset-1 bg-gradient-to-r from-primary to-primary-container rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-1000"
          ></div>
          <div
            class="relative bg-surface-container-lowest rounded-2xl p-6 editorial-shadow border border-outline-variant/15 flex items-center gap-6"
          >
            <div
              class="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
            >
              <span class="material-symbols-outlined text-primary text-3xl">shield_lock</span>
            </div>
            <div>
              <div class="text-xs font-bold text-primary tracking-wider mb-1 uppercase">
                Consejo Profesional
              </div>
              <p class="text-on-surface text-sm leading-snug">
                Usa una contraseña única para cada cuenta para mantener la integridad de tu
                santuario digital.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Functional card -->
      <div class="col-span-1 lg:col-span-5 w-full">
        <div
          class="bg-surface-container-lowest rounded-2xl p-8 md:p-12 editorial-shadow border border-outline-variant/10 relative overflow-hidden"
        >
          <!-- Mobile logo -->
          <div class="lg:hidden flex items-center justify-center mb-10">
            <div class="flex items-center gap-2">
              <div
                class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary"
              >
                <span class="material-symbols-outlined text-sm">lock_reset</span>
              </div>
              <span class="text-xl font-black tracking-tight text-primary">Agendly</span>
            </div>
          </div>

          <!-- Success state -->
          <div v-if="submitted" class="text-center space-y-6">
            <div
              class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto"
            >
              <span
                class="material-symbols-outlined text-green-600 text-4xl"
                style="font-variation-settings: 'FILL' 1"
                >mark_email_read</span
              >
            </div>
            <div>
              <h2 class="text-2xl font-bold text-on-surface mb-2 tracking-tight">
                ¡Revisa tu correo!
              </h2>
              <p class="text-on-surface-variant text-sm leading-relaxed">
                Si existe una cuenta con
                <span class="font-semibold text-on-surface">{{ email }}</span
                >, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
            </div>
            <NuxtLink
              to="/login"
              class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <span
                class="material-symbols-outlined text-lg"
                style="font-variation-settings: 'FILL' 0"
                >chevron_left</span
              >
              Volver al inicio de sesión
            </NuxtLink>
          </div>

          <!-- Form state -->
          <template v-else>
            <div class="mb-10 text-center lg:text-left">
              <h2 class="text-2xl font-bold text-on-surface mb-3 tracking-tight">
                Restablecer Contraseña
              </h2>
              <p class="text-on-surface-variant text-sm leading-relaxed">
                Ingresa la dirección de correo electrónico asociada a tu cuenta y te enviaremos un
                enlace de recuperación.
              </p>
            </div>

            <form class="space-y-8" @submit.prevent="handleSubmit">
              <div class="space-y-2">
                <label
                  for="email"
                  class="block text-xs font-semibold text-on-surface-variant uppercase tracking-widest ml-1"
                >
                  Correo Electrónico
                </label>
                <div class="relative">
                  <div
                    class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline"
                  >
                    <span class="material-symbols-outlined" style="font-size: 20px">mail</span>
                  </div>
                  <input
                    id="email"
                    v-model="email"
                    type="email"
                    name="email"
                    required
                    placeholder="nombre@empresa.com"
                    class="block w-full pl-11 pr-4 py-4 bg-surface-container-high border-none rounded-xl text-on-surface focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-200 placeholder:text-outline"
                  />
                </div>
                <p v-if="errorMsg" class="text-xs text-red-600 ml-1">{{ errorMsg }}</p>
              </div>

              <div class="pt-2 space-y-5">
                <button
                  type="submit"
                  :disabled="loading"
                  class="w-full py-4 px-6 soul-gradient text-on-primary font-bold rounded-full shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100"
                >
                  <span>{{ loading ? 'Enviando...' : 'Enviar enlace de recuperación' }}</span>
                  <span v-if="!loading" class="material-symbols-outlined text-lg">
                    arrow_forward
                  </span>
                </button>

                <div class="flex items-center justify-center">
                  <NuxtLink
                    to="/login"
                    class="flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors group"
                  >
                    <span
                      class="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform"
                      >chevron_left</span
                    >
                    <span>Volver al Inicio de Sesión</span>
                  </NuxtLink>
                </div>
              </div>
            </form>

            <div class="mt-12 pt-8 border-t border-surface-container text-center">
              <p class="text-xs text-on-surface-variant">
                ¿Aún tienes problemas?
                <a href="#" class="text-primary font-semibold hover:underline">
                  Contactar a Soporte
                </a>
              </p>
            </div>
          </template>

          <!-- Corner glow -->
          <div
            class="absolute -bottom-8 -right-8 w-24 h-24 bg-yellow-100/20 rounded-full blur-2xl pointer-events-none"
          ></div>
        </div>

        <!-- Mobile legal footer -->
        <div
          class="mt-8 flex justify-center gap-6 text-[10px] text-outline font-medium uppercase tracking-widest lg:hidden"
        >
          <NuxtLink to="/privacidad" class="hover:text-on-surface">Política de Privacidad</NuxtLink>
          <a href="#" class="hover:text-on-surface">Términos de Servicio</a>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

const config = useRuntimeConfig();
const apiUrl = config.public.apiUrl;

const email = ref('');
const loading = ref(false);
const submitted = ref(false);
const errorMsg = ref('');

async function handleSubmit() {
  if (!email.value) return;
  errorMsg.value = '';
  loading.value = true;

  try {
    // The backend always answers the same generic 200 whether or not the email
    // exists (anti-enumeration), so a successful response is always "check your inbox".
    await $fetch(`${apiUrl}/auth/forgot-password`, {
      method: 'POST',
      body: { email: email.value },
    });
    submitted.value = true;
  } catch {
    // Network/server failure — the request never went through; let the user retry.
    errorMsg.value = 'No pudimos procesar tu solicitud. Intenta de nuevo en unos momentos.';
  } finally {
    loading.value = false;
  }
}
</script>
