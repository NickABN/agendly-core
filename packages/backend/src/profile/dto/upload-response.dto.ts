import { ImageVersionDto } from './image-version.dto';

export class UploadResponseDto {
  url: string;
  imageVersion: ImageVersionDto;
}
