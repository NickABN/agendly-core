import { defineStore } from 'pinia';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  onboardedAt: string | null;
  trialEndsAt: string;
  isActive: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    user: null,
    tenant: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isOnboarded: (state) => !!state.tenant?.onboardedAt,
    trialDaysRemaining: (state) => {
      if (!state.tenant?.trialEndsAt) return 0;
      const diff = new Date(state.tenant.trialEndsAt).getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    },
    isTrialExpired(): boolean {
      return this.trialDaysRemaining <= 0;
    },
  },

  actions: {
    setAuth(token: string, user: User, tenant?: Tenant) {
      this.token = token;
      this.user = user;
      if (tenant) this.tenant = tenant;
      if (import.meta.client) {
        localStorage.setItem('agendly_token', token);
      }
    },

    setTenant(tenant: Tenant) {
      this.tenant = tenant;
    },

    logout() {
      this.token = null;
      this.user = null;
      this.tenant = null;
      if (import.meta.client) {
        localStorage.removeItem('agendly_token');
      }
      navigateTo('/login');
    },

    loadTokenFromStorage() {
      if (import.meta.client) {
        const token = localStorage.getItem('agendly_token');
        if (token) {
          this.token = token;
        }
      }
    },
  },
});
