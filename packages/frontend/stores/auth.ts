import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'INCOMPLETE';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  onboardedAt: string | null;
  trialEndsAt: string;
  isActive: boolean;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string | null;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<User | null>(null);
  const tenant = ref<Tenant | null>(null);

  const isAuthenticated = computed(() => !!token.value);
  const isOnboarded = computed(() => !!tenant.value?.onboardedAt);
  const trialDaysRemaining = computed(() => {
    if (!tenant.value?.trialEndsAt) return 0;
    const diff = new Date(tenant.value.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });
  const isTrialExpired = computed(() => trialDaysRemaining.value <= 0);

  /** Acceso vigente: suscrito (ACTIVE/PAST_DUE) o en prueba no vencida. */
  const hasAccess = computed(() => {
    const status = tenant.value?.subscriptionStatus;
    if (status === 'ACTIVE' || status === 'PAST_DUE') return true;
    if (status === 'CANCELED' || status === 'INCOMPLETE') return false;
    // TRIALING (o legacy sin status): depende de la prueba
    return !isTrialExpired.value;
  });

  function setAuth(newToken: string, newUser: User, newTenant?: Tenant) {
    token.value = newToken;
    user.value = newUser;
    if (newTenant) tenant.value = newTenant;
    if (import.meta.client) {
      localStorage.setItem('agendly_token', newToken);
    }
  }

  function setTenant(newTenant: Tenant) {
    tenant.value = newTenant;
  }

  function logout() {
    token.value = null;
    user.value = null;
    tenant.value = null;
    if (import.meta.client) {
      localStorage.removeItem('agendly_token');
    }
    void navigateTo('/login');
  }

  function loadTokenFromStorage() {
    if (import.meta.client) {
      const stored = localStorage.getItem('agendly_token');
      if (stored) {
        token.value = stored;
      }
    }
  }

  return {
    token,
    user,
    tenant,
    isAuthenticated,
    isOnboarded,
    trialDaysRemaining,
    isTrialExpired,
    hasAccess,
    setAuth,
    setTenant,
    logout,
    loadTokenFromStorage,
  };
});
