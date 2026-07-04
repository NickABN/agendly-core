<script setup lang="ts">
const { store } = useAuth();
const route = useRoute();

const userInitials = computed(() => getInitials(store.user?.name || store.tenant?.name || 'A'));
const userName = computed(() => store.user?.name || store.tenant?.name || 'Admin');
const tenantName = computed(() => store.tenant?.name || '');

const drawerOpen = ref(false);

const navItems = [
  { to: '/admin', icon: 'calendar_today', label: 'Agenda', exact: true },
  { to: '/admin/clients', icon: 'groups', label: 'Clientes' },
  { to: '/admin/services', icon: 'content_cut', label: 'Servicios' },
  { to: '/admin/staff', icon: 'badge', label: 'Personal' },
  { to: '/admin/config', icon: 'settings', label: 'Configuración' },
];

// Close the drawer on navigation
watch(() => route.fullPath, () => {
  drawerOpen.value = false;
});
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-[var(--color-surface)] font-['Inter',sans-serif] text-[var(--color-on-surface)]">
    <!-- Mobile drawer backdrop -->
    <Transition name="fade">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-40 bg-black/40 md:hidden"
        aria-hidden="true"
        @click="drawerOpen = false"
      ></div>
    </Transition>

    <!-- Sidebar: drawer on mobile, fixed on md+ -->
    <aside
      class="flex flex-col h-full w-64 bg-slate-50 border-r border-[var(--color-outline-variant)]/10 z-50 shrink-0 transition-transform duration-200 fixed md:sticky top-0 md:translate-x-0"
      :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Logo + Tenant -->
      <div class="p-6 pb-4 flex items-start justify-between">
        <div>
          <h1 class="text-xl font-bold text-[var(--color-primary)] tracking-tight">Agendly</h1>
          <p class="text-xs text-[var(--color-on-surface-variant)] font-medium mt-0.5">{{ tenantName }}</p>
        </div>
        <button
          class="p-1.5 hover:bg-slate-200/60 rounded-lg transition-colors md:hidden"
          aria-label="Cerrar menú"
          @click="drawerOpen = false"
        >
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-4 space-y-1" aria-label="Navegación principal">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-[var(--color-on-surface-variant)] hover:bg-slate-200/40"
          active-class="bg-slate-200/60 !text-[var(--color-primary)] font-semibold"
          :exact-active-class="item.exact ? 'bg-slate-200/60 !text-[var(--color-primary)] font-semibold' : undefined"
        >
          <span class="material-symbols-outlined text-xl" aria-hidden="true">{{ item.icon }}</span>
          {{ item.label }}
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
    <div class="flex-1 flex flex-col overflow-hidden min-w-0">
      <!-- Mobile top bar with hamburger -->
      <div class="flex md:hidden items-center gap-2 px-3 h-12 bg-white border-b border-[var(--color-outline-variant)]/10 shrink-0">
        <button
          class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Abrir menú"
          @click="drawerOpen = true"
        >
          <span class="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
        <span class="text-sm font-bold text-[var(--color-primary)]">Agendly</span>
      </div>

      <slot />
    </div>
  </div>
</template>
