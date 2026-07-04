import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | undefined;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') ?? '';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.logger.warn('R2 storage not configured — uploads will fail');
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (!this.s3Client) {
      throw new Error('R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL in .env');
    }
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to upload object to R2: key=${key}`, error);
      throw new Error(
        `Error al subir el archivo al almacenamiento: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return `${this.publicUrl}/${key}`;
  }
}
