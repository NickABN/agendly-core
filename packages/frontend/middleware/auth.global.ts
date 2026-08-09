import { useAuthStore } from '~/stores/auth';

interface MeResponse {
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
}

/**
 * Intenta UN refresh (rotación) antes de dar la sesión por perdida. En SSR reenvía
 * la cookie entrante y propaga los Set-Cookie nuevos al navegador; devuelve el header
 * Cookie fresco para reintentar /auth/me en el mismo render (el browser aún no tiene
 * las cookies nuevas dentro de esta pasada SSR).
 */
async function tryRefresh(
  base: string,
): Promise<{ ok: boolean; cookieHeader?: string }> {
  try {
    const res = await $fetch.raw(`${base}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: import.meta.server ? useRequestHeaders(['cookie']) : {},
    });
    if (import.meta.server) {
      const event = useRequestEvent();
      const setCookies = res.headers.getSetCookie?.() ?? [];
      const pairs: string[] = [];
      for (const c of setCookies) {
        if (event) appendResponseHeader(event, 'set-cookie', c);
        const pair = c.split(';')[0];
        if (pair) pairs.push(pair);
      }
      return { ok: true, cookieHeader: pairs.join('; ') };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  const store = useAuthStore();

  // Public routes (landing, auth pages, /[slug] booking pages). Reserved
  // slugs like /admin or /onboarding are NOT booking pages — see utils/publicRoutes.
  if (isPublicRoutePath(to.path)) return;

  // Fuente de verdad de la sesión: la cookie httpOnly. Cargamos el perfil vía
  // /auth/me reenviando la cookie (funciona en SSR y en cliente → sin rebote en F5).
  if (!store.user) {
    // apiBase(): URL interna en Docker SSR; same-origin /api on Netlify.
    const base = apiBase();
    const ssrCookie = () =>
      import.meta.server ? useRequestHeaders(['cookie']) : {};

    let profile: MeResponse | null = null;
    try {
      profile = await $fetch<MeResponse>(`${base}/auth/me`, {
        credentials: 'include',
        headers: ssrCookie(),
      });
    } catch {
      // Access token vencido → intentamos rotar el refresh antes de rebotar.
      const refreshed = await tryRefresh(base);
      if (!refreshed.ok) return navigateTo('/login');
      try {
        profile = await $fetch<MeResponse>(`${base}/auth/me`, {
          credentials: 'include',
          headers: import.meta.server
            ? { cookie: refreshed.cookieHeader ?? '' }
            : {},
        });
      } catch {
        return navigateTo('/login');
      }
    }

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
