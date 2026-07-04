import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UploadService } from './upload.service';
import { StorageService } from './storage.service';
import { GeocoderService } from './geocoder.service';

@Module({
  imports: [ConfigModule],
  controllers: [ProfileController],
  providers: [ProfileService, UploadService, StorageService, GeocoderService],
})
export class ProfileModule {}
