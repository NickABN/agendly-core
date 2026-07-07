export class PrismaClient {}
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type AppointmentChannel = 'WEB' | 'MANUAL' | 'WHATSAPP';
export type AppointmentStatus =
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';
export type Role = 'OWNER' | 'ADMIN';
export type Service = {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMXN: unknown;
  isActive: boolean;
  deletedAt: Date | null;
};
export type Tenant = Record<string, unknown>;
export type RefreshToken = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  familyExpiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
};
