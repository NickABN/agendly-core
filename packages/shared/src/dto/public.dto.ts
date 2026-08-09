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
  tenant: { name: string; slug: string; timezone: string };
  services: PublicServiceDto[];
  employees: PublicEmployeeDto[];
}
