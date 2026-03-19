import { useAuthStore } from '~/stores/auth';
import type { RegisterDto, LoginDto, AuthResponseDto } from '@agendly/shared';

export function useAuth() {
  const config = useRuntimeConfig();
  const store = useAuthStore();
  const apiUrl = config.public.apiUrl;

  async function register(data: RegisterDto) {
    const response = await $fetch<AuthResponseDto>(`${apiUrl}/auth/register`, {
      method: 'POST',
      body: data,
    });
    store.setAuth(response.accessToken, response.user);
    await fetchMe();
    return response;
  }

  async function login(data: LoginDto) {
    const response = await $fetch<AuthResponseDto>(`${apiUrl}/auth/login`, {
      method: 'POST',
      body: data,
    });
    store.setAuth(response.accessToken, response.user);
    await fetchMe();
    return response;
  }

  function loginWithGoogle() {
    window.location.href = `${apiUrl}/auth/google`;
  }

  async function fetchMe() {
    if (!store.token) return;
    try {
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
        };
      }>(`${apiUrl}/auth/me`, {
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
    }
  }

  function logout() {
    store.logout();
  }

  return {
    register,
    login,
    loginWithGoogle,
    fetchMe,
    logout,
    store,
  };
}
