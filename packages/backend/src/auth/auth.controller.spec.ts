import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PasswordResetService } from './password-reset.service';

// ---------------------------------------------------------------------------
// S3 — Google OAuth callback UX: a failed Google auth (no req.user, set by the
// guard that no longer throws) must redirect to ${FRONTEND_URL}/login?error=google
// instead of returning a raw JSON 401. A successful auth keeps the previous
// behaviour: set session cookies and redirect to ${FRONTEND_URL}/auth/callback.
// ---------------------------------------------------------------------------

const FRONTEND_URL = 'https://app.example.com';

function makeConfig(): ConfigService {
  return {
    get: jest.fn(
      (_key: string, fallback?: unknown) => FRONTEND_URL ?? fallback,
    ),
  } as unknown as ConfigService;
}

function makeRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  };
}

describe('AuthController.googleCallback (S3)', () => {
  it('redirects to /login?error=google when Google auth failed (no user)', async () => {
    const authService = {
      findOrCreateGoogleUser: jest.fn(),
    } as unknown as AuthService;
    const controller = new AuthController(
      authService,
      {} as TokenService,
      {} as PasswordResetService,
      makeConfig(),
    );
    const res = makeRes();

    await controller.googleCallback({ user: undefined } as never, res as never);

    expect(authService.findOrCreateGoogleUser).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND_URL}/login?error=google`,
    );
  });

  it('redirects to /login?error=google when the service rejects (e.g. unverified)', async () => {
    const authService = {
      findOrCreateGoogleUser: jest
        .fn()
        .mockRejectedValue(new Error('unverified')),
    } as unknown as AuthService;
    const controller = new AuthController(
      authService,
      {} as TokenService,
      {} as PasswordResetService,
      makeConfig(),
    );
    const res = makeRes();

    await controller.googleCallback(
      {
        user: {
          googleId: 'g',
          email: 'x@y.com',
          name: 'X',
          emailVerified: false,
        },
      } as never,
      res as never,
    );

    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND_URL}/login?error=google`,
    );
  });

  it('sets session cookies and redirects to /auth/callback on success', async () => {
    const authService = {
      findOrCreateGoogleUser: jest.fn().mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
      }),
    } as unknown as AuthService;
    const controller = new AuthController(
      authService,
      {} as TokenService,
      {} as PasswordResetService,
      makeConfig(),
    );
    const res = makeRes();

    await controller.googleCallback(
      {
        user: {
          googleId: 'g',
          email: 'x@y.com',
          name: 'X',
          emailVerified: true,
        },
      } as never,
      res as never,
    );

    expect(res.cookie).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/auth/callback`);
  });
});
