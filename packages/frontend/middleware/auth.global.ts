import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
  const store = useAuthStore();

  // Public routes that don't need auth
  const publicRoutes = ['/login', '/register', '/auth/callback', '/privacidad', '/arco'];
  const isPublicRoute =
    publicRoutes.some((route) => to.path.startsWith(route)) ||
    to.path === '/' ||
    to.path.match(/^\/[a-z0-9-]+$/) !== null; // /[slug] booking pages

  // Load token from storage on first load
  if (import.meta.client && !store.token) {
    store.loadTokenFromStorage();
  }

  if (isPublicRoute) return;

  // Protected route — needs auth
  if (!store.token) {
    return navigateTo('/login');
  }

  // If we have token but no user data, fetch profile
  if (!store.user) {
    try {
      const config = useRuntimeConfig();
      const profile = await $fetch<{
        id: string;
        email: string;
        name: string;
        role: string;
        tenantId: string;
        tenant: {
          id: string;
          name: string;
          slug: string;
          onboardedAt: string | null;
          trialEndsAt: string;
          isActive: boolean;
          subscriptionStatus?:
            | 'TRIALING'
            | 'ACTIVE'
            | 'PAST_DUE'
            | 'CANCELED'
            | 'INCOMPLETE';
          currentPeriodEnd?: string | null;
        };
      }>(`${config.public.apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${store.token}` },
      });
      store.setAuth(store.token, {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        tenantId: profile.tenantId,
      }, profile.tenant);
    } catch {
      store.logout();
      return navigateTo('/login');
    }
  }

  // If not onboarded, redirect to onboarding (unless already there)
  if (!store.isOnboarded && !to.path.startsWith('/onboarding')) {
    return navigateTo('/onboarding');
  }

  // Sin acceso vigente (prueba vencida y sin suscripción): forzar a pagar.
  // Se permite la propia página de suscripción para no dejar al tenant encerrado.
  if (!store.hasAccess && !to.path.startsWith('/admin/subscription')) {
    return navigateTo('/admin/subscription');
  }
});
