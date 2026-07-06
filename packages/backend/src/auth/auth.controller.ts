import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AUTH_COOKIE, authCookieOptions } from './cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Anti fuerza-bruta: 5 intentos/min por IP en las rutas de credenciales (OWASP A07)
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.register(dto);
    res.cookie(AUTH_COOKIE, accessToken, authCookieOptions());
    return { user };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.login(dto);
    res.cookie(AUTH_COOKIE, accessToken, authCookieOptions());
    return { user };
  }

  /** Cierra sesión: borra la cookie httpOnly (JS no puede hacerlo). */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    // clearCookie debe usar los mismos flags con los que se seteó
    const { maxAge: _maxAge, ...opts } = authCookieOptions();
    res.clearCookie(AUTH_COOKIE, opts);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: { userId: string }) {
    return this.authService.getProfile(user.userId);
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Guard redirects to Google
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(
    @Req() req: { user: { googleId: string; email: string; name: string } },
    @Res() res: Response,
  ) {
    const { accessToken } = await this.authService.findOrCreateGoogleUser(
      req.user,
    );
    // La cookie se setea en el redirect; el token ya NO viaja en la URL (OWASP A07)
    res.cookie(AUTH_COOKIE, accessToken, authCookieOptions());
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3001',
    );
    res.redirect(`${frontendUrl}/auth/callback`);
  }
}
