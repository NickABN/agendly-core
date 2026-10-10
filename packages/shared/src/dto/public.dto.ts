/** Response of GET /public/:slug — the public booking page payload. */
export interface PublicServiceDto {
  id: string;
  name: string;
  durationMinutes: number;
  priceMXN: string;
}

export interface PublicEmployeeDto {
  id: string;
  name: string;
  serviceIds: string[];
}

export interface PublicTenantResponse {
  /** `timezone` is the tenant's IANA timezone — drives all public date/time display. */
  tenant: {
    name: string;
    slug: string;
    timezone: string;
    /** Branding/contact the owner set in their business profile (null when unset). */
    logoUrl: string | null;
    bannerUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  services: PublicServiceDto[];
  employees: PublicEmployeeDto[];
}
