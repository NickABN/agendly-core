<script setup lang="ts">
defineProps<{ title: string; updatedAt: string }>();
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)] text-[var(--color-on-surface)]">
    <header
      class="sticky top-0 z-10 flex items-center justify-between h-14 px-4 md:px-8 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10"
    >
      <NuxtLink to="/" class="flex items-center gap-2 font-bold text-[var(--color-primary)]">
        <span class="material-symbols-outlined text-xl" aria-hidden="true">auto_awesome</span>
        Agendly
      </NuxtLink>
      <nav
        class="flex gap-4 text-xs font-medium text-[var(--color-on-surface-variant)]"
        aria-label="Documentos legales"
      >
        <NuxtLink to="/terminos" active-class="text-[var(--color-primary)]">Términos</NuxtLink>
        <NuxtLink to="/privacidad" active-class="text-[var(--color-primary)]">Privacidad</NuxtLink>
        <NuxtLink to="/arco" active-class="text-[var(--color-primary)]">ARCO</NuxtLink>
      </nav>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-8 md:py-12">
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">{{ title }}</h1>
      <p class="text-xs text-[var(--color-outline)] mb-8">Última actualización: {{ updatedAt }}</p>

      <article
        class="legal-doc bg-white rounded-2xl p-5 md:p-8 shadow-sm border border-[var(--color-outline-variant)]/10 text-sm leading-relaxed text-[var(--color-on-surface-variant)]"
      >
        <slot />
      </article>
    </main>
  </div>
</template>

<style scoped>
.legal-doc :deep(h2) {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
}
.legal-doc :deep(h2:first-child) {
  margin-top: 0;
}
.legal-doc :deep(h3) {
  font-weight: 600;
  color: var(--color-on-surface);
  margin-top: 1rem;
  margin-bottom: 0.25rem;
}
.legal-doc :deep(p) {
  margin-bottom: 0.75rem;
}
.legal-doc :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.legal-doc :deep(li) {
  margin-bottom: 0.25rem;
}
.legal-doc :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
