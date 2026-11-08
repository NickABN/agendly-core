import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID =
      configService.get<string>('GOOGLE_CLIENT_ID') || 'not-configured';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET') || 'not-configured';
    super({
      clientID,
      clientSecret,
      callbackURL: configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3000/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      emails?: { value: string; verified?: boolean | string }[];
      displayName: string;
      _json?: { email_verified?: boolean | string };
    },
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value ?? '';
    // Google reports verification on the email entry (`verified`) and/or in the
    // raw payload (`email_verified`). Accept booleans and the string 'true' only
    // (the library occasionally returns the raw string). A missing email can
    // never be considered verified.
    const emailVerified =
      email.length > 0 &&
      (isVerifiedFlag(profile.emails?.[0]?.verified) ||
        isVerifiedFlag(profile._json?.email_verified));
    const user = {
      googleId: profile.id,
      email,
      name: profile.displayName,
      emailVerified,
    };
    done(null, user);
  }
}

/** True only for a real `true` or the literal string 'true'. */
function isVerifiedFlag(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}
