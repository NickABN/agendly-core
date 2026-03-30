<script setup lang="ts">
const { store } = useAuth();

const userInitials = computed(() => {
  const name = store.user?.name || store.tenant?.name || 'A';
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
});

const userName = computed(() => store.user?.name || store.tenant?.name || 'Admin');
const tenantName = computed(() => store.tenant?.name || '');
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-[var(--color-surface)] font-['Inter',sans-serif] text-[var(--color-on-surface)]">
    <!-- Sidebar -->
    <aside class="flex flex-col h-full w-64 bg-slate-50 border-r border-[var(--color-outline-variant)]/10 sticky top-0 z-50 shrink-0">
      <!-- Logo + Tenant -->
      <div class="p-6 pb-4">
        <h1 class="text-xl font-bold text-[var(--color-primary)] tracking-tight">Agendly</h1>
        <p class="text-xs text-[var(--color-on-surface-variant)] font-medium mt-0.5">{{ tenantName }}</p>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-4 space-y-1">
        <NuxtLink
          to="/admin"
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm"
          active-class="bg-slate-200/60 !text-[var(--color-primary)] font-semibold"
          exact-active-class="bg-slate-200/60 !text-[var(--color-primary)] font-semibold"
          :class="'text-[var(--color-on-surface-variant)] hover:bg-slate-200/40'"
        >
          <span class="material-symbols-outlined text-xl">calendar_today</span>
          Agenda
        </NuxtLink>
        <NuxtLink
          to="/admin/clients"
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm"
          :class="'text-[var(--color-on-surface-variant)] hover:bg-slate-200/40'"
          active-class="bg-slate-200/60 !text-[var(--color-primary)] font-semibold"
        >
          <span class="material-symbols-outlined text-xl">groups</span>
          Clientes
        </NuxtLink>
        <NuxtLink
          to="/admin/services"
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm"
          :class="'text-[var(--color-on-surface-variant)] hover:bg-slate-200/40'"
          active-class="bg-slate-200/60 !text-[var(--color-primary)] font-semibold"
        >
          <span class="material-symbols-outlined text-xl">content_cut</span>
          Servicios
        </NuxtLink>
        <NuxtLink
          to="/admin/staff"
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm"
          :class="'text-[var(--color-on-surface-variant)] hover:bg-slate-200/40'"
          active-class="bg-slate-200/60 !text-[var(--color-primary)] font-semibold"
        >
          <span class="material-symbols-outlined text-xl">badge</span>
          Personal
        </NuxtLink>
        <NuxtLink
          to="/admin/config"
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm"
          :class="'text-[var(--color-on-surface-variant)] hover:bg-slate-200/40'"
          active-class="bg-slate-200/60 !text-[var(--color-primary)] font-semibold"
        >
          <span class="material-symbols-outlined text-xl">settings</span>
          Configuración
        </NuxtLink>
      </nav>

      <!-- User profile -->
      <div class="p-4 border-t border-[var(--color-outline-variant)]/10">
        <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-200/40 transition-colors cursor-pointer">
          <div class="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-bold shrink-0">
            {{ userInitials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-[var(--color-on-surface)] truncate">{{ userName }}</p>
            <p class="text-xs text-[var(--color-on-surface-variant)]">Admin</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <slot />
    </div>
  </div>
</template>
