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
  tenant: { name: string; slug: string };
  services: PublicServiceDto[];
  employees: PublicEmployeeDto[];
}
