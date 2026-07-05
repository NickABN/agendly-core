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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UploadService } from '../profile/upload.service';

@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  findCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantService.findById(tenantId);
  }

  @Patch()
  update(@CurrentTenant() tenantId: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(tenantId, dto);
  }

  /**
   * Sube el logo vía el mismo pipeline que /profile/logo: optimización con
   * sharp (resize + WebP) y almacenamiento en R2 (URL absoluta persistente).
   * Antes escribía a disco local — efímero en contenedores.
   */
  @Post('logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    await this.uploadService.uploadLogo(tenantId, file);
    // Mantiene el shape de respuesta previo (el tenant completo con logoUrl)
    return this.tenantService.findById(tenantId);
  }

  @Post('complete-onboarding')
  completeOnboarding(@CurrentTenant() tenantId: string) {
    return this.tenantService.completeOnboarding(tenantId);
  }
}
