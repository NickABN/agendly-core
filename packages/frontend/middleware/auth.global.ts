import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
  const store = useAuthStore();

  // Public routes that don't need auth
  const publicRoutes = ['/login', '/register', '/auth/callback', '/privacidad', '/arco'];
  const isPublicRoute =
    publicRoutes.some((route) => to.path.startsWith(route)) ||
    to.path === '/' ||
    to.path.match(/^\/[a-z0-9-]+$/) !== null; // /[slug] booking pages

  if (isPublicRoute) return;

  // Fuente de verdad de la sesión: la cookie httpOnly. Cargamos el perfil vía
  // /auth/me reenviando la cookie (funciona en SSR y en cliente → sin rebote en F5).
  if (!store.user) {
    try {
      // apiBase(): URL interna del backend en SSR (dentro de Docker localhost:3000
      // es el propio frontend), pública en el cliente.
      const base = apiBase();
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
      }>(`${base}/auth/me`, {
        credentials: 'include',
        headers: import.meta.server ? useRequestHeaders(['cookie']) : {},
      });
      store.setAuth(
        {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          tenantId: profile.tenantId,
        },
        profile.tenant,
      );
    } catch {
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
