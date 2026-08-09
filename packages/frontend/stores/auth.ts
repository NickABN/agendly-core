import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** IANA timezone of the business (optional for legacy cached payloads). */
  timezone?: string;
  onboardedAt: string | null;
  trialEndsAt: string;
  isActive: boolean;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string | null;
}

/**
 * Estado de sesión. El JWT vive en una cookie httpOnly (invisible a JS), así que
 * el store NO guarda el token: la "autenticación" se deriva de tener el usuario
 * cargado vía /auth/me (que el navegador acompaña con la cookie automáticamente).
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const tenant = ref<Tenant | null>(null);

  const isAuthenticated = computed(() => !!user.value);
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

  function setAuth(newUser: User, newTenant?: Tenant) {
    user.value = newUser;
    if (newTenant) tenant.value = newTenant;
  }

  function setTenant(newTenant: Tenant) {
    tenant.value = newTenant;
  }

  /** Limpia el estado local (la cookie se borra vía POST /auth/logout). */
  function clear() {
    user.value = null;
    tenant.value = null;
  }

  return {
    user,
    tenant,
    isAuthenticated,
    isOnboarded,
    trialDaysRemaining,
    isTrialExpired,
    hasAccess,
    setAuth,
    setTenant,
    clear,
  };
});
