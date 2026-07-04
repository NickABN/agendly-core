import type { ProfileDto } from '@agendly/shared';
import type { Tenant } from '../generated/prisma/client.js';

/**
 * Single Tenant→DTO mapper. Used by TenantService and ProfileService so the
 * two never drift on null handling again.
 */
export function mapTenantToProfileDto(tenant: Tenant): ProfileDto {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    phone: tenant.phone ?? null,
    address: tenant.address ?? null,
    logoUrl: tenant.logoUrl ?? null,
    bannerUrl: tenant.bannerUrl ?? null,
    latitude:
      tenant.latitude !== null && tenant.latitude !== undefined
        ? Number(tenant.latitude)
        : null,
    longitude:
      tenant.longitude !== null && tenant.longitude !== undefined
        ? Number(tenant.longitude)
        : null,
    timezone: tenant.timezone,
    onboardedAt: tenant.onboardedAt ? tenant.onboardedAt.toISOString() : null,
    trialEndsAt: tenant.trialEndsAt.toISOString(),
    isActive: tenant.isActive,
  };
}
