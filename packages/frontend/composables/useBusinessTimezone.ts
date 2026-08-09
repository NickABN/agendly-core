import { computed } from 'vue';
import { BUSINESS_TZ } from '@agendly/shared';
import { useAuthStore } from '~/stores/auth';

/**
 * The logged-in tenant's IANA timezone (from /auth/me), used by every admin
 * view that renders or groups instants. Falls back to the platform default
 * while the session is loading or for legacy payloads without `timezone`.
 */
export function useBusinessTimezone() {
  const store = useAuthStore();
  return computed(() => store.tenant?.timezone ?? BUSINESS_TZ);
}
