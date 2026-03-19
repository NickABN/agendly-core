export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  onboardedAt: string | null;
  trialEndsAt: string;
  isActive: boolean;
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  phone?: string;
  address?: string;
  timezone?: string;
}
