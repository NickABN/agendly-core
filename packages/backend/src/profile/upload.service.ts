import {
  BadGatewayException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { ImageVersionDto } from './dto/image-version.dto';
import { UploadResponseDto } from './dto/upload-response.dto';
import { IMAGE_PRESETS, processImage, safeBaseName } from './image-processor';
import type { ProcessedImage } from './image-processor';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class UploadService {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  private validateFile(file: Express.Multer.File, maxSizeMb: number): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(
        'Solo se permiten archivos JPEG, PNG o WebP',
      );
    }

    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new UnprocessableEntityException(
        `El archivo excede el tamaño máximo de ${maxSizeMb} MB`,
      );
    }
  }

  /** Optimiza (resize + WebP) antes de subir; rechaza buffers que no son imagen. */
  private async optimize(
    file: Express.Multer.File,
    preset: keyof typeof IMAGE_PRESETS,
  ): Promise<ProcessedImage> {
    try {
      return await processImage(file.buffer, IMAGE_PRESETS[preset]);
    } catch {
      throw new UnprocessableEntityException(
        'El archivo no es una imagen válida',
      );
    }
  }

  async uploadLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    this.validateFile(file, 5);
    const processed = await this.optimize(file, 'logo');

    const key = `tenants/${tenantId}/logos/${Date.now()}-${safeBaseName(file.originalname)}.webp`;
    let url: string;

    try {
      url = await this.storageService.upload(
        key,
        processed.buffer,
        processed.contentType,
      );
    } catch {
      throw new BadGatewayException(
        'Error al subir el archivo al almacenamiento',
      );
    }

    const [, imageVersion] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { logoUrl: url },
      }),
      this.prisma.imageVersion.create({
        data: {
          tenantId,
          url,
          fileSize: processed.buffer.length,
          imageType: 'LOGO' as const,
        },
      }),
    ]);

    return { url, imageVersion: this.toVersionDto(imageVersion) };
  }

  async uploadBanner(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    this.validateFile(file, 8);
    const processed = await this.optimize(file, 'banner');

    const key = `tenants/${tenantId}/banners/${Date.now()}-${safeBaseName(file.originalname)}.webp`;
    let url: string;

    try {
      url = await this.storageService.upload(
        key,
        processed.buffer,
        processed.contentType,
      );
    } catch {
      throw new BadGatewayException(
        'Error al subir el archivo al almacenamiento',
      );
    }

    const [, imageVersion] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { bannerUrl: url },
      }),
      this.prisma.imageVersion.create({
        data: {
          tenantId,
          url,
          fileSize: processed.buffer.length,
          imageType: 'BANNER' as const,
        },
      }),
    ]);

    return { url, imageVersion: this.toVersionDto(imageVersion) };
  }

  private toVersionDto(imageVersion: {
    id: string;
    tenantId: string;
    url: string;
    fileSize: number;
    imageType: string;
    createdAt: Date;
  }): ImageVersionDto {
    return {
      id: imageVersion.id,
      tenantId: imageVersion.tenantId,
      url: imageVersion.url,
      fileSize: imageVersion.fileSize,
      imageType: imageVersion.imageType as 'LOGO' | 'BANNER',
      createdAt: imageVersion.createdAt.toISOString(),
    };
  }
}
