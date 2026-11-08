import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  /**
   * On a failed Google auth (passport error, denied consent, or no user) we do
   * NOT throw a raw 401. Returning a falsy user lets the guard activate the
   * route so the `/auth/google/callback` handler can redirect the browser to a
   * friendly login error page. A successful auth returns the user unchanged.
   */
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
