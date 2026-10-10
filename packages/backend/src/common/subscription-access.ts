import type { SubscriptionStatus } from '../generated/prisma/client.js';

/**
 * ¿Se exige suscripción pagada? Mientras Agendly opere gratis (sin cobro), la
 * prueba de 14 días NO debe apagar a ningún negocio. Activar solo con
 * `BILLING_ENFORCED=true` cuando haya términos de pago publicados.
 */
export function isBillingEnforced(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.BILLING_ENFORCED === 'true';
}

/**
 * ¿El tenant tiene acceso vigente para operar de cara al público?
 * Siempre requiere `isActive`. Con billing activado además requiere
 * suscripción ACTIVE/PAST_DUE o prueba TRIALING no vencida; un negocio con la
 * prueba vencida y sin pago deja de tomar reservas.
 */
export function hasActiveAccess(
  tenant: {
    isActive: boolean;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt: Date;
  },
  billingEnforced: boolean = isBillingEnforced(),
): boolean {
  if (!tenant.isActive) return false;
  if (!billingEnforced) return true;
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
