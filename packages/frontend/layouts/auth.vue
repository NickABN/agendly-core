<template>
  <div class="flex min-h-screen bg-[var(--color-surface)] font-['Inter',sans-serif] text-[var(--color-on-surface)]">
    <!-- Brand Sidebar - Desktop Only -->
    <aside class="hidden lg:flex lg:w-[450px] flex-col justify-between p-12 relative overflow-hidden text-white" style="background: linear-gradient(135deg, #005da9 0%, #0076d3 100%)">
      <!-- Background Image Overlay -->
      <div class="absolute inset-0 z-0 opacity-15 bg-[url('https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80')] bg-cover bg-center"></div>

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
              <span class="material-symbols-outlined mt-1 text-[var(--color-primary-fixed)]">verified</span>
              <div>
                <p class="font-semibold text-lg">Control absoluto</p>
                <p class="text-white/70 text-sm">Gestiona agenda, clientes y personal desde un solo lugar.</p>
              </div>
            </li>
            <li class="flex items-start gap-4">
              <span class="material-symbols-outlined mt-1 text-[var(--color-primary-fixed)]">notifications_active</span>
              <div>
                <p class="font-semibold text-lg">Recordatorios automáticos</p>
                <p class="text-white/70 text-sm">Reduce inasistencias hasta en un 40% con avisos vía WhatsApp.</p>
              </div>
            </li>
            <li class="flex items-start gap-4">
              <span class="material-symbols-outlined mt-1 text-[var(--color-primary-fixed)]">insights</span>
              <div>
                <p class="font-semibold text-lg">Reportes inteligentes</p>
                <p class="text-white/70 text-sm">Entiende el crecimiento de tu salón con datos reales.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Testimonial -->
      <div class="relative z-10 glass-panel p-6 rounded-xl border border-white/10 shadow-2xl">
        <div class="flex items-center gap-1 mb-4">
          <span v-for="i in 5" :key="i" class="material-symbols-outlined text-amber-400" style="font-variation-settings: 'FILL' 1">star</span>
        </div>
        <p class="text-white/80 italic text-sm mb-4 leading-relaxed">
          "Desde que usamos Agendly, el salón se siente realmente como un santuario. Todo fluye sin interrupciones."
        </p>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span class="text-sm font-bold">AK</span>
          </div>
          <div>
            <p class="text-sm font-bold">Ana Karen Silva</p>
            <p class="text-xs text-white/60">Dueña de Salón Calma</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Form Area -->
    <main class="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-24">
      <!-- Mobile Logo -->
      <div class="lg:hidden flex items-center gap-2 mb-12">
        <span class="material-symbols-outlined text-[var(--color-primary)] text-3xl">auto_awesome</span>
        <span class="text-xl font-bold tracking-tight">Agendly</span>
      </div>

      <div class="w-full max-w-md">
        <slot />
      </div>
    </main>
  </div>
</template>
