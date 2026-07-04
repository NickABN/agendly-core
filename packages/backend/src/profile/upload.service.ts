import { BadGatewayException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { ImageVersionDto } from './dto/image-version.dto';
import { UploadResponseDto } from './dto/upload-response.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

@Injectable()
export class UploadService {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  private validateFile(file: Express.Multer.File, maxSizeMb: number): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException('Solo se permiten archivos JPEG o PNG');
    }

    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new UnprocessableEntityException(
        `El archivo excede el tamaño máximo de ${maxSizeMb} MB`,
      );
    }
  }

  async uploadLogo(tenantId: string, file: Express.Multer.File): Promise<UploadResponseDto> {
    this.validateFile(file, 5);

    const key = `tenants/${tenantId}/logos/${Date.now()}-${file.originalname}`;
    let url: string;

    try {
      url = await this.storageService.upload(key, file.buffer, file.mimetype);
    } catch {
      throw new BadGatewayException('Error al subir el archivo al almacenamiento');
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
          fileSize: file.size,
          imageType: 'LOGO' as const,
        },
      }),
    ]);

    const versionDto: ImageVersionDto = {
      id: imageVersion.id,
      tenantId: imageVersion.tenantId,
      url: imageVersion.url,
      fileSize: imageVersion.fileSize,
      imageType: imageVersion.imageType as 'LOGO' | 'BANNER',
      createdAt: imageVersion.createdAt.toISOString(),
    };

    return { url, imageVersion: versionDto };
  }

  async uploadBanner(tenantId: string, file: Express.Multer.File): Promise<UploadResponseDto> {
    this.validateFile(file, 8);

    const key = `tenants/${tenantId}/banners/${Date.now()}-${file.originalname}`;
    let url: string;

    try {
      url = await this.storageService.upload(key, file.buffer, file.mimetype);
    } catch {
      throw new BadGatewayException('Error al subir el archivo al almacenamiento');
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
          fileSize: file.size,
          imageType: 'BANNER' as const,
        },
      }),
    ]);

    const versionDto: ImageVersionDto = {
      id: imageVersion.id,
      tenantId: imageVersion.tenantId,
      url: imageVersion.url,
      fileSize: imageVersion.fileSize,
      imageType: imageVersion.imageType as 'LOGO' | 'BANNER',
      createdAt: imageVersion.createdAt.toISOString(),
    };

    return { url, imageVersion: versionDto };
  }
}
