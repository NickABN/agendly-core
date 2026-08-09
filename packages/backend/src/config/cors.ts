/** Default local frontend origin used when no public URLs are configured. */
const LOCAL_FRONTEND_ORIGIN = 'http://localhost:3001';

interface CorsEnv {
  FRONTEND_URL?: string;
  PUBLIC_APP_URL?: string;
}

/**
 * Builds the CORS allowlist from the admin frontend and the public booking
 * site URLs. CORS matches origins (scheme + host + port), so each value is
 * normalized down to its origin; invalid or unset values are dropped and
 * duplicates collapse. Falls back to the local dev frontend when empty.
 */
export function buildCorsAllowlist(env: CorsEnv): string[] {
  const origins = new Set<string>();

  for (const value of [env.FRONTEND_URL, env.PUBLIC_APP_URL]) {
    if (typeof value !== 'string' || value.trim() === '') {
      continue;
    }
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Not a valid URL — env.validation already rejects this in production.
    }
  }

  return origins.size > 0 ? [...origins] : [LOCAL_FRONTEND_ORIGIN];
}
