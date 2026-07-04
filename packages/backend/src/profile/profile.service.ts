import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeocoderService } from './geocoder.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ImageVersionDto } from './dto/image-version.dto';
import type { ProfileDto, LocationUpdateResponseDto } from '@agendly/shared';
import { mapTenantToProfileDto } from '../tenant/tenant.mapper';
import type { Tenant } from '../generated/prisma/client.js';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoder: GeocoderService,
  ) {}

  async getProfile(tenantId: string): Promise<ProfileDto> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    return this.mapToProfileDto(tenant);
  }

  async updateProfile(
    tenantId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileDto> {
    // Build update data with only the fields present in dto (PATCH semantics)
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.phone !== undefined) data['phone'] = dto.phone;
    if (dto.timezone !== undefined) data['timezone'] = dto.timezone;

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    return this.mapToProfileDto(tenant);
  }

  async updateLocation(
    tenantId: string,
    dto: UpdateLocationDto,
  ): Promise<LocationUpdateResponseDto> {
    // If explicit coordinates are provided, validate ranges and save directly
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      if (dto.latitude < -90 || dto.latitude > 90) {
        throw new UnprocessableEntityException({
          message: 'Coordenadas inválidas',
          errors: { latitude: 'La latitud debe estar entre -90 y 90' },
        });
      }
      if (dto.longitude < -180 || dto.longitude > 180) {
        throw new UnprocessableEntityException({
          message: 'Coordenadas inválidas',
          errors: { longitude: 'La longitud debe estar entre -180 y 180' },
        });
      }

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });

      return {
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
      };
    }

    // No explicit coordinates — attempt geocoding (non-blocking)
    let geocodingWarning: string | undefined;
    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      const result = await this.geocoder.geocode(dto.address);
      if (result) {
        latitude = result.latitude;
        longitude = result.longitude;
      } else {
        geocodingWarning =
          'No se encontraron coordenadas para la dirección proporcionada';
      }
    } catch {
      geocodingWarning = 'No se pudo geocodificar la dirección';
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        address: dto.address,
        latitude: latitude,
        longitude: longitude,
      },
    });

    return {
      address: dto.address,
      latitude,
      longitude,
      ...(geocodingWarning ? { geocodingWarning } : {}),
    };
  }

  async getImageHistory(tenantId: string): Promise<ImageVersionDto[]> {
    const versions = await this.prisma.imageVersion.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return versions.map((v) => ({
      id: v.id,
      tenantId: v.tenantId,
      url: v.url,
      fileSize: v.fileSize,
      imageType: v.imageType as 'LOGO' | 'BANNER',
      createdAt: v.createdAt.toISOString(),
    }));
  }

  private mapToProfileDto(tenant: Tenant): ProfileDto {
    return mapTenantToProfileDto(tenant);
  }
}
