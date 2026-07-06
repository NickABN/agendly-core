import type { SubscriptionStatus } from '../generated/prisma/client.js';

/**
 * ¿El tenant tiene acceso vigente para operar de cara al público?
 * Requiere `isActive` y (suscripción ACTIVE/PAST_DUE, o prueba TRIALING no vencida).
 * Un negocio con la prueba vencida y sin pago deja de tomar reservas.
 */
export function hasActiveAccess(tenant: {
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date;
}): boolean {
  if (!tenant.isActive) return false;
  if (
    tenant.subscriptionStatus === 'ACTIVE' ||
    tenant.subscriptionStatus === 'PAST_DUE'
  ) {
    return true;
  }
  return (
    tenant.subscriptionStatus === 'TRIALING' &&
    tenant.trialEndsAt.getTime() > Date.now()
  );
}
