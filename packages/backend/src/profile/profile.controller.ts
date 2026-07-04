import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Role } from '@agendly/shared';
import { ProfileService } from './profile.service';
import { UploadService } from './upload.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import type { ProfileDto, ImageVersionDto, UploadResponseDto, LocationUpdateResponseDto } from '@agendly/shared';

@Controller('profile')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  getProfile(@CurrentTenant() tenantId: string): Promise<ProfileDto> {
    return this.profileService.getProfile(tenantId);
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  updateProfile(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDto> {
    return this.profileService.updateProfile(tenantId, dto);
  }

  @Patch('location')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  updateLocation(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationUpdateResponseDto> {
    return this.profileService.updateLocation(tenantId, dto);
  }

  @Post('logo')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.uploadService.uploadLogo(tenantId, file);
  }

  @Post('banner')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadBanner(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.uploadService.uploadBanner(tenantId, file);
  }

  @Get('images')
  getImageHistory(@CurrentTenant() tenantId: string): Promise<ImageVersionDto[]> {
    return this.profileService.getImageHistory(tenantId);
  }
}
