import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/** Constant-time comparison of two secrets of any length. */
export function secretsMatch(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Guards the system job endpoints called by GitHub Actions with the shared
 * `CRON_SECRET` (x-cron-secret header). 503 when not configured, 401 on mismatch.
 */
export function assertCronSecret(
  expected: string | undefined,
  provided: string | undefined,
): void {
  if (!expected) {
    throw new ServiceUnavailableException('Jobs programados no configurados');
  }
  if (!provided || !secretsMatch(provided, expected)) {
    throw new UnauthorizedException();
  }
}
