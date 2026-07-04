export class ImageVersionDto {
  id: string;
  tenantId: string;
  url: string;
  fileSize: number;
  imageType: 'LOGO' | 'BANNER';
  createdAt: string;
}
