/**
 * Cold-start handling for the sleeping backend.
 *
 * The backend runs on Render's free plan, which suspends the server after a period
 * of inactivity. The first request afterwards wakes it up and can take up to ~1
 * minute; meanwhile the Netlify `/api` proxy (or the browser) gives up with a
 * network error, a timeout or a 502/503/504. Those are infrastructure symptoms,
 * not app failures, so they get a transparent message and a retry instead of a
 * generic error.
 *
 * Everything here is pure (no Nuxt context) so the policy is unit-testable; the
 * client plugin `plugins/cold-start.client.ts` wires it into `$fetch`.
 */

/** Statuses the proxy/hosting returns while the backend is asleep or waking up. */
const COLD_START_STATUSES = new Set([502, 503, 504]);

/** Methods that are safe to repeat automatically (no side effects). */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Automatic retries for idempotent requests (after the first attempt). */
export const COLD_START_MAX_RETRIES = 3;

/** Short message for inline errors (forms, cards) after a cold-start failure. */
export const COLD_START_INLINE_MESSAGE =
  'El servidor está despertando (usamos un plan gratuito de hosting). Espera unos segundos y vuelve a intentarlo.';

interface ErrorLike {
  name?: unknown;
  cause?: unknown;
  status?: unknown;
  statusCode?: unknown;
  data?: unknown;
  response?: { status?: unknown };
}

function statusOf(err: ErrorLike): number | undefined {
  const status = err.response?.status ?? err.statusCode ?? err.status;
  return typeof status === 'number' && status > 0 ? status : undefined;
}

/**
 * True when the body is an error produced by our NestJS backend
 * (`{ statusCode, message, error: 'Service Unavailable' }`), as opposed to a
 * proxy/hosting error page. The backend legitimately answers 502/503 in a few
 * places ("Pagos no configurados", upload failures): those are real errors.
 * Nitro/h3 proxy errors carry `error: true` and `statusMessage` instead.
 */
function isBackendAppError(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const body = data as Record<string, unknown>;
  return 'message' in body && body.error !== true && !('statusMessage' in body);
}

function isUserAbort(err: ErrorLike): boolean {
  const cause = err.cause as { name?: unknown } | undefined;
  return err.name === 'AbortError' || cause?.name === 'AbortError';
}

/**
 * Classifies a fetch error as a cold-start symptom (backend asleep / waking up)
 * versus a real error that the caller must handle (4xx validation, 401 refresh,
 * 409 conflicts, backend 5xx with a message).
 */
export function isColdStartError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as ErrorLike;
  if (e.name === 'ColdStartError') return true;

  const status = statusOf(e);
  if (status === undefined) {
    // No HTTP response at all: network failure or timeout while the server boots.
    // A deliberate abort (navigation, cancelled request) is not a cold start.
    return !isUserAbort(e);
  }
  return COLD_START_STATUSES.has(status) && !isBackendAppError(e.data);
}

export function isIdempotentMethod(method: string | undefined): boolean {
  return IDEMPOTENT_METHODS.has((method ?? 'GET').toUpperCase());
}

/** Exponential backoff between automatic retries: 3 s, 6 s, 12 s (capped at 15 s). */
export function coldStartRetryDelay(retry: number): number {
  return Math.min(3000 * 2 ** retry, 15_000);
}

/**
 * Whether `err` should be retried automatically. `retry` is the number of retries
 * already made. Non-idempotent requests (POST/PATCH/PUT/DELETE) are never retried:
 * the first attempt may have reached the server, so the user decides.
 */
export function shouldRetryColdStart(err: unknown, method: string | undefined, retry: number) {
  return isIdempotentMethod(method) && retry < COLD_START_MAX_RETRIES && isColdStartError(err);
}

/** Error thrown after a cold-start failure; keeps the original status for callers. */
export class ColdStartError extends Error {
  override readonly name = 'ColdStartError';
  readonly statusCode?: number;
  readonly status?: number;
  readonly response?: unknown;
  /** Callers commonly show `err.data?.message`: make it the transparent message. */
  readonly data = { message: COLD_START_INLINE_MESSAGE };

  constructor(readonly original: unknown) {
    super(COLD_START_INLINE_MESSAGE);
    const e = (original ?? {}) as ErrorLike;
    this.statusCode = statusOf(e);
    this.status = this.statusCode;
    this.response = e.response;
  }
}

/** What the UI shows while/after a request hits a sleeping backend. */
export interface ColdStartNotifier {
  /** An automatic retry is about to happen. */
  waking(): void;
  /** A request that had been waiting succeeded: the server is awake. */
  recovered(): void;
  /** Gave up; `read` = page data (reload helps), `write` = user action to repeat. */
  failed(kind: 'read' | 'write'): void;
  /** Any API request succeeded (the server is awake). */
  succeeded(kind: 'read' | 'write'): void;
}

export type ColdStartNoticePhase = 'hidden' | 'waking' | 'failed-read' | 'failed-write';

/**
 * Notice state after a successful API request. "waking" always clears. A failed-write
 * notice clears only when a write succeeds (the user repeated the action), so an
 * unrelated background read cannot hide it before the user has acted.
 */
export function noticePhaseAfterSuccess(
  phase: ColdStartNoticePhase,
  kind: 'read' | 'write',
): ColdStartNoticePhase {
  if (phase === 'waking') return 'hidden';
  if (phase === 'failed-write' && kind === 'write') return 'hidden';
  return phase;
}

type Fetcher = (request: unknown, options?: { method?: string }) => Promise<unknown>;

export interface ColdStartOptions {
  notifier: ColdStartNotifier;
  /** Only requests to our API are handled; anything else passes through untouched. */
  isApiRequest: (request: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wraps a fetch function with the cold-start policy: idempotent requests are retried
 * with backoff while the notifier shows "waking up"; non-idempotent ones fail fast.
 * Real errors are rethrown untouched; cold-start failures become `ColdStartError`.
 */
export function withColdStartHandling<F extends Fetcher>(fetcher: F, opts: ColdStartOptions): F {
  const sleep = opts.sleep ?? defaultSleep;

  const wrapped = async (request: unknown, options?: { method?: string }) => {
    if (!opts.isApiRequest(request)) return fetcher(request, options);

    const method = options?.method;
    let retry = 0;
    for (;;) {
      try {
        const result = await fetcher(request, options);
        if (retry > 0) opts.notifier.recovered();
        opts.notifier.succeeded(isIdempotentMethod(method) ? 'read' : 'write');
        return result;
      } catch (err) {
        if (!isColdStartError(err)) throw err;
        if (!shouldRetryColdStart(err, method, retry)) {
          opts.notifier.failed(isIdempotentMethod(method) ? 'read' : 'write');
          throw new ColdStartError(err);
        }
        opts.notifier.waking();
        await sleep(coldStartRetryDelay(retry));
        retry += 1;
      }
    }
  };

  return wrapped as F;
}

/** True when `url` targets the API base (`/api` on Netlify, absolute URL locally). */
export function isApiUrl(url: unknown, apiBaseUrl: string): boolean {
  if (typeof url !== 'string' || !apiBaseUrl) return false;
  const base = apiBaseUrl.replace(/\/+$/, '');
  return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`);
}
