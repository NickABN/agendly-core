<template>
  <div
    class="flex min-h-screen bg-[var(--color-surface)] font-['Inter',sans-serif] text-[var(--color-on-surface)]"
  >
    <!-- Brand Sidebar - Desktop Only -->
    <aside
      class="hidden lg:flex lg:w-[450px] flex-col justify-between p-12 relative overflow-hidden text-white"
      style="background: linear-gradient(135deg, #005da9 0%, #0076d3 100%)"
    >
      <!-- Background Image Overlay -->
      <div
        class="absolute inset-0 z-0 opacity-15 bg-[url('https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80')] bg-cover bg-center"
      ></div>

      <div class="relative z-10">
        <!-- Logo -->
        <div class="flex items-center gap-3 mb-16">
          <span class="material-symbols-outlined text-4xl">auto_awesome</span>
          <span class="text-2xl font-extrabold tracking-tight">Agendly</span>
        </div>

        <!-- Headline -->
        <div class="space-y-12">
          <h2 class="text-4xl font-semibold leading-tight tracking-tight">
            Eleva la calma de tu negocio hoy mismo.
          </h2>

          <!-- Benefits -->
          <ul class="space-y-8">
            <li class="flex items-start gap-4">
              <span class="material-symbols-outlined mt-1 text-[var(--color-primary-fixed)]"
                >link</span
              >
              <div>
                <p class="font-semibold text-lg">Reservas sin cuenta</p>
                <p class="text-white/70 text-sm">
                  Tus clientes agendan desde tu enlace público, sin registrarse.
                </p>
              </div>
            </li>
            <li class="flex items-start gap-4">
              <span class="material-symbols-outlined mt-1 text-[var(--color-primary-fixed)]"
                >notifications_active</span
              >
              <div>
                <p class="font-semibold text-lg">Recordatorios automáticos</p>
                <p class="text-white/70 text-sm">
                  Cada cliente recibe un correo 24 horas antes de su cita.
                </p>
              </div>
            </li>
            <li class="flex items-start gap-4">
              <span class="material-symbols-outlined mt-1 text-[var(--color-primary-fixed)]"
                >insights</span
              >
              <div>
                <p class="font-semibold text-lg">Métricas e inasistencias</p>
                <p class="text-white/70 text-sm">
                  Mide el impacto de tu agenda y detecta citas con riesgo de inasistencia.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </aside>

    <!-- Form Area -->
    <main class="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-24">
      <!-- Mobile Logo -->
      <div class="lg:hidden flex items-center gap-2 mb-12">
        <span class="material-symbols-outlined text-[var(--color-primary)] text-3xl"
          >auto_awesome</span
        >
        <span class="text-xl font-bold tracking-tight">Agendly</span>
      </div>

      <div class="w-full max-w-md">
        <slot />
      </div>
    </main>
  </div>
</template>
