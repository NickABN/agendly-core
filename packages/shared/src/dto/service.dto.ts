export interface ServiceDto {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMXN: string;
  isActive: boolean;
}

export interface CreateServiceDto {
  name: string;
  durationMinutes: number;
  bufferMinutes?: number;
  priceMXN: number;
}

export interface UpdateServiceDto {
  name?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  priceMXN?: number;
  isActive?: boolean;
}
