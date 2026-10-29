import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed, stateless links that let a client manage (view / cancel) their own
 * appointment without an account: `<appointmentId>.<hmac>`.
 *
 * The key is derived from JWT_SECRET with a domain label, so these signatures
 * can never be confused with JWTs. No DB state: any email (confirmation,
 * reschedule, reminder) can carry the link, and it stops being useful once the
 * appointment is no longer CONFIRMED or already started.
 */
@Injectable()
export class AppointmentLinkService {
  private readonly key: Buffer;
  private readonly publicAppUrl: string;

  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET') ?? '';
    this.key = createHmac('sha256', secret)
      .update('agendly:appointment-link:v1')
      .digest();
    this.publicAppUrl = (
      configService.get<string>('PUBLIC_APP_URL') ||
      configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3001'
    ).replace(/\/+$/, '');
  }

  sign(appointmentId: string): string {
    return `${appointmentId}.${this.signature(appointmentId)}`;
  }

  /** Returns the appointment id when the token is authentic, else null. */
  verify(token: string): string | null {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const id = token.slice(0, dot);
    const given = Buffer.from(token.slice(dot + 1));
    const expected = Buffer.from(this.signature(id));
    if (given.length !== expected.length) return null;
    return timingSafeEqual(given, expected) ? id : null;
  }

  /** Public page where the client sees and can cancel the appointment. */
  manageUrl(appointmentId: string): string {
    return `${this.publicAppUrl}/cita/${this.sign(appointmentId)}`;
  }

  private signature(appointmentId: string): string {
    return createHmac('sha256', this.key)
      .update(appointmentId)
      .digest('base64url');
  }
}
