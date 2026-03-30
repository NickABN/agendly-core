import {
  BadRequestException,
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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  findCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantService.findById(tenantId);
  }

  @Patch()
  update(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.update(tenantId, dto);
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads/logos',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now().toString(36);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
          cb(new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WebP)'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    const logoUrl = `/uploads/logos/${file.filename}`;
    return this.tenantService.updateLogoUrl(tenantId, logoUrl);
  }

  @Post('complete-onboarding')
  completeOnboarding(@CurrentTenant() tenantId: string) {
    return this.tenantService.completeOnboarding(tenantId);
  }
}
