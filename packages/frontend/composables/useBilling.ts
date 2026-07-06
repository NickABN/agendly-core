import { ref } from 'vue';

export interface BillingStatus {
  subscriptionStatus: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  trialDaysRemaining: number;
  hasStripeCustomer: boolean;
  configured: boolean;
}

/** Estado y acciones de la suscripción SaaS del tenant (Stripe). */
export function useBilling() {
  const api = useApi();

  const status = ref<BillingStatus | null>(null);
  const pending = ref(false);
  const redirecting = ref(false);
  const error = ref('');

  async function loadStatus() {
    pending.value = true;
    error.value = '';
    try {
      status.value = await api.get<BillingStatus>('/billing/status');
    } catch {
      error.value = 'No se pudo cargar el estado de la suscripción.';
    } finally {
      pending.value = false;
    }
  }

  async function subscribe() {
    redirecting.value = true;
    error.value = '';
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout');
      window.location.href = url;
    } catch (e: unknown) {
      redirecting.value = false;
      error.value = extractMessage(e, 'No se pudo iniciar el pago.');
    }
  }

  async function openPortal() {
    redirecting.value = true;
    error.value = '';
    try {
      const { url } = await api.post<{ url: string }>('/billing/portal');
      window.location.href = url;
    } catch (e: unknown) {
      redirecting.value = false;
      error.value = extractMessage(e, 'No se pudo abrir el portal.');
    }
  }

  return { status, pending, redirecting, error, loadStatus, subscribe, openPortal };
}

function extractMessage(e: unknown, fallback: string): string {
  const err = e as { data?: { message?: string } };
  return err.data?.message || fallback;
}
