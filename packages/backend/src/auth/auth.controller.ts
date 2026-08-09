import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PasswordResetService } from './password-reset.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  AUTH_COOKIE,
  REFRESH_COOKIE,
  authCookieOptions,
  refreshCookieOptions,
} from './cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly passwordResetService: PasswordResetService,
    private readonly configService: ConfigService,
  ) {}

  /** Setea ambas cookies (access + refresh) con sus flags respectivos. */
  private setSessionCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    res.cookie(AUTH_COOKIE, accessToken, authCookieOptions());
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  }

  /** Limpia ambas cookies (mismos flags/paths con los que se setearon, sin maxAge). */
  private clearSessionCookies(res: Response) {
    const { maxAge: _a, ...authOpts } = authCookieOptions();
    const { maxAge: _r, ...refreshOpts } = refreshCookieOptions();
    res.clearCookie(AUTH_COOKIE, authOpts);
    res.clearCookie(REFRESH_COOKIE, refreshOpts);
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = (req.cookies ?? {}) as Record<string, string>;
    return cookies[REFRESH_COOKIE];
  }

  // Anti fuerza-bruta: 5 intentos/min por IP en las rutas de credenciales (OWASP A07)
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);
    this.setSessionCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setSessionCookies(res, accessToken, refreshToken);
    return { user };
  }

  /**
   * Always returns the same generic 200 body (anti-enumeration): the response never
   * reveals whether the email exists. Throttled as tight as login (brute force).
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordResetService.requestReset(dto.email);
    return {
      message:
        'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña',
    };
  }

  /** Consumes a reset token; invalid/expired/used tokens → 400 with a Spanish message. */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(dto.token, dto.password);
    return { message: 'Tu contraseña se actualizó correctamente' };
  }

  /**
   * Renueva el access token rotando el refresh. Sin JwtAuthGuard: el access puede
   * estar vencido (justamente por eso se refresca). En error limpia ambas cookies
   * para que el cliente deje de reintentar.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = this.readRefreshCookie(req);
    if (!cookie) throw new UnauthorizedException();
    try {
      const { accessToken, refreshCookieValue } =
        await this.tokenService.rotate(cookie);
      this.setSessionCookies(res, accessToken, refreshCookieValue);
      return { ok: true };
    } catch (err) {
      this.clearSessionCookies(res);
      throw err;
    }
  }

  /** Cierra la sesión actual: revoca la familia del refresh y borra ambas cookies. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.tokenService.revoke(this.readRefreshCookie(req), {
      wholeFamily: true,
    });
    this.clearSessionCookies(res);
  }

  /** Cierra sesión en todos los dispositivos: revoca todas las familias del usuario. */
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: { userId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.tokenService.revokeAllForUser(user.userId);
    this.clearSessionCookies(res);
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
    const { accessToken, refreshToken } =
      await this.authService.findOrCreateGoogleUser(req.user);
    // Las cookies se setean en el redirect; el token ya NO viaja en la URL (OWASP A07)
    this.setSessionCookies(res, accessToken, refreshToken);
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3001',
    );
    res.redirect(`${frontendUrl}/auth/callback`);
  }
}
