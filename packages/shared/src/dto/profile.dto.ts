export interface ProfileDto {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  onboardedAt: string | null;
  trialEndsAt: string;
  isActive: boolean;
}

export interface UpdateProfileDto {
  name?: string; // 2–100 chars
  phone?: string; // E.164 format
  timezone?: string; // IANA identifier
}

export interface UpdateLocationDto {
  address: string;
  latitude?: number; // -90 to 90
  longitude?: number; // -180 to 180
}

export interface ImageVersionDto {
  id: string;
  tenantId: string;
  url: string;
  fileSize: number;
  imageType: 'LOGO' | 'BANNER';
  createdAt: string;
}

export interface UploadResponseDto {
  url: string;
  imageVersion: ImageVersionDto;
}

export interface LocationUpdateResponseDto {
  address: string;
  latitude: number | null;
  longitude: number | null;
  geocodingWarning?: string; // present when geocoding was skipped or failed
}
