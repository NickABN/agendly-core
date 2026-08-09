import { useAuthStore } from '~/stores/auth';
import type { RegisterDto, LoginDto } from '@agendly/shared';

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
    timezone?: string;
    onboardedAt: string | null;
    trialEndsAt: string;
    isActive: boolean;
    subscriptionStatus?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
    currentPeriodEnd?: string | null;
  };
}

export function useAuth() {
  const config = useRuntimeConfig();
  const store = useAuthStore();
  const apiUrl = config.public.apiUrl;

  // El backend setea la cookie httpOnly en la respuesta; luego cargamos el perfil.
  async function register(data: RegisterDto) {
    await $fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      body: data,
      credentials: 'include',
    });
    await fetchMe();
  }

  async function login(data: LoginDto) {
    await $fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      body: data,
      credentials: 'include',
    });
    await fetchMe();
  }

  function loginWithGoogle() {
    window.location.href = `${apiUrl}/auth/google`;
  }

  async function fetchMe() {
    try {
      // apiBase(): URL interna en Docker SSR; same-origin /api on Netlify.
      const p = await $fetch<MeResponse>(`${apiBase()}/auth/me`, {
        credentials: 'include',
        headers: import.meta.server ? useRequestHeaders(['cookie']) : {},
      });
      store.setAuth(
        { id: p.id, email: p.email, name: p.name, role: p.role, tenantId: p.tenantId },
        p.tenant,
      );
    } catch {
      store.clear();
    }
  }

  async function logout() {
    try {
      await $fetch(`${apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // aunque falle, limpiamos el estado local
    }
    store.clear();
    await navigateTo('/login');
  }

  return { register, login, loginWithGoogle, fetchMe, logout, store };
}
