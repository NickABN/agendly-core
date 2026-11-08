import { describe, it, expect, vi } from 'vitest';
import {
  COLD_START_INLINE_MESSAGE,
  COLD_START_MAX_RETRIES,
  ColdStartError,
  coldStartRetryDelay,
  isApiUrl,
  isColdStartError,
  noticePhaseAfterSuccess,
  shouldRetryColdStart,
  withColdStartHandling,
} from './coldStart';

/** Shape of an ofetch FetchError with an HTTP response. */
function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`${status}`), {
    name: 'FetchError',
    statusCode: status,
    response: { status },
    data,
  });
}

const networkError = Object.assign(new Error('fetch failed'), {
  name: 'FetchError',
  cause: new TypeError('Failed to fetch'),
});
const timeoutError = Object.assign(new Error('timeout'), {
  name: 'FetchError',
  cause: Object.assign(new Error('aborted due to timeout'), { name: 'TimeoutError' }),
});
const userAbort = Object.assign(new Error('aborted'), {
  name: 'FetchError',
  cause: Object.assign(new Error('aborted'), { name: 'AbortError' }),
});

type TestFetchOptions = {
  method?: string;
  retry?: number | false;
  retryStatusCodes?: number[];
  [key: string]: unknown;
};

type TestFetcher = (request: unknown, options?: TestFetchOptions) => Promise<unknown>;

const OFETCH_DEFAULT_RETRY_STATUSES = new Set([
  408, 409, 425, 429, 500, 501, 502, 503, 504, 521, 522, 524,
]);

/** Models ofetch's default single GET retry for the transient statuses in this contract. */
function withDefaultGetRetry(transport: TestFetcher) {
  return vi.fn(async (request: unknown, options?: TestFetchOptions) => {
    const method = (options?.method ?? 'GET').toUpperCase();
    const maxRetries =
      options?.retry === false ? 0 : (options?.retry ?? (method === 'GET' ? 1 : 0));
    const retryStatusCodes = new Set(options?.retryStatusCodes ?? OFETCH_DEFAULT_RETRY_STATUSES);
    let retries = 0;

    for (;;) {
      try {
        return await transport(request, options);
      } catch (error) {
        const fetchError = error as {
          response?: { status?: unknown };
          statusCode?: unknown;
          status?: unknown;
        };
        const status = fetchError.response?.status ?? fetchError.statusCode ?? fetchError.status;
        if (retries >= maxRetries || typeof status !== 'number' || !retryStatusCodes.has(status)) {
          throw error;
        }
        retries += 1;
      }
    }
  });
}

describe('isColdStartError — classifier', () => {
  it.each([
    ['network error (no response)', networkError],
    ['timeout', timeoutError],
    ['502 from the proxy (HTML body)', httpError(502, '<html>Bad Gateway</html>')],
    ['503 from hosting (no body)', httpError(503)],
    ['504 gateway timeout', httpError(504)],
    [
      '502 from the Nitro proxy (h3 error body)',
      httpError(502, { error: true, statusCode: 502, statusMessage: 'Bad Gateway', message: 'x' }),
    ],
    ['SSR-normalized error (503, data.coldStart)', httpError(503, { coldStart: true })],
  ])('treats %s as cold start', (_label, err) => {
    expect(isColdStartError(err)).toBe(true);
  });

  it('recognizes a serialized ColdStartError after Nuxt loses its name and status', () => {
    const coldStartError = new ColdStartError(networkError);
    const wrappedError = Object.assign(new Error('wrapped'), {
      statusCode: 500,
      data: coldStartError.data,
    });

    expect(isColdStartError(wrappedError)).toBe(true);
  });

  it('classifies an AbortError caused by the request timeout, not a user signal', () => {
    const timeoutAbort = Object.assign(new Error('fetch failed'), {
      name: 'FetchError',
      cause: Object.assign(new Error('aborted'), { name: 'AbortError' }),
    });

    expect(isColdStartError(timeoutAbort, { timeout: 8000 })).toBe(true);
    expect(
      isColdStartError(timeoutAbort, {
        timeout: 8000,
        signal: new AbortController().signal,
      }),
    ).toBe(false);
    expect(isColdStartError(userAbort)).toBe(false);
  });

  it.each([
    ['plain interceptor error', new Error('token refresh failed')],
    ['URL/configuration error', new TypeError('Invalid API base URL')],
  ])('does NOT classify a %s as a cold start', (_label, err) => {
    expect(isColdStartError(err)).toBe(false);
  });

  it('does NOT classify a responseless FetchError as cold start while the browser is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });

    try {
      expect(isColdStartError(networkError)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    ['400 validation', httpError(400, { message: ['email inválido'], statusCode: 400 })],
    ['401 (refresh flow must run)', httpError(401)],
    ['404', httpError(404)],
    ['409 slot taken', httpError(409, { message: 'Horario ocupado' })],
    ['500 backend error', httpError(500, { statusCode: 500, message: 'Error inesperado' })],
    [
      '503 from the backend itself (Nest body)',
      httpError(503, {
        statusCode: 503,
        message: 'Pagos no configurados',
        error: 'Service Unavailable',
      }),
    ],
    [
      '502 from the backend itself (upload failure)',
      httpError(502, { statusCode: 502, message: 'No se pudo subir', error: 'Bad Gateway' }),
    ],
    ['user abort', userAbort],
    ['non-object', 'boom'],
    ['null', null],
  ])('does NOT treat %s as cold start', (_label, err) => {
    expect(isColdStartError(err)).toBe(false);
  });
});

describe('retry policy', () => {
  it('backs off exponentially and caps at 15 s', () => {
    expect([0, 1, 2, 3].map(coldStartRetryDelay)).toEqual([3000, 6000, 12_000, 15_000]);
  });

  it('retries idempotent methods only, up to the limit', () => {
    const err = httpError(503);
    expect(shouldRetryColdStart(err, undefined, 0)).toBe(true); // default GET
    expect(shouldRetryColdStart(err, 'get', 0)).toBe(true);
    expect(shouldRetryColdStart(err, 'GET', COLD_START_MAX_RETRIES - 1)).toBe(true);
    expect(shouldRetryColdStart(err, 'GET', COLD_START_MAX_RETRIES)).toBe(false);
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(shouldRetryColdStart(err, method, 0)).toBe(false);
    }
  });

  it('never retries real errors', () => {
    expect(shouldRetryColdStart(httpError(400), 'GET', 0)).toBe(false);
  });

  it('retries an AbortError when it came from the configured request timeout', () => {
    const timeoutAbort = Object.assign(new Error('fetch failed'), {
      name: 'FetchError',
      cause: Object.assign(new Error('aborted'), { name: 'AbortError' }),
    });

    expect(shouldRetryColdStart(timeoutAbort, 'GET', 0, { timeout: 8000 })).toBe(true);
  });
});

describe('withColdStartHandling', () => {
  function setupFetcher(fetcher: TestFetcher) {
    const notifier = { waking: vi.fn(), recovered: vi.fn(), failed: vi.fn(), succeeded: vi.fn() };
    const sleep = vi.fn(() => Promise.resolve());
    const wrapped = withColdStartHandling(fetcher, {
      notifier,
      isApiRequest: (r) => isApiUrl(r, '/api'),
      sleep,
    });
    return { fetcher, notifier, sleep, wrapped };
  }

  function setup(impl: (...args: unknown[]) => Promise<unknown>) {
    return setupFetcher(vi.fn(impl));
  }

  it('GET: retries with backoff while waking, then resolves and clears the notice', async () => {
    let calls = 0;
    const { fetcher, notifier, sleep, wrapped } = setup(() => {
      calls += 1;
      return calls <= 2 ? Promise.reject(httpError(502)) : Promise.resolve({ ok: true });
    });

    await expect(wrapped('/api/tenants/me')).resolves.toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([3000, 6000]);
    expect(notifier.waking).toHaveBeenCalledTimes(2);
    expect(notifier.recovered).toHaveBeenCalledTimes(1);
    expect(notifier.failed).not.toHaveBeenCalled();
  });

  it('GET: gives up after the retry limit with a ColdStartError and a "read" failure', async () => {
    const { fetcher, notifier, wrapped } = setup(() => Promise.reject(networkError));

    const err = await wrapped('/api/x').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ColdStartError);
    expect((err as ColdStartError).data.message).toBe(COLD_START_INLINE_MESSAGE);
    expect((err as ColdStartError).original).toBe(networkError);
    expect(fetcher).toHaveBeenCalledTimes(COLD_START_MAX_RETRIES + 1);
    expect(notifier.failed).toHaveBeenCalledWith('read');
    expect(notifier.recovered).not.toHaveBeenCalled();
  });

  it('POST: does NOT auto-retry; fails once with a "write" failure keeping the status', async () => {
    const { fetcher, notifier, sleep, wrapped } = setup(() => Promise.reject(httpError(504)));

    const err = await wrapped('/api/auth/register', { method: 'POST' }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ColdStartError);
    expect((err as ColdStartError).statusCode).toBe(504);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(notifier.waking).not.toHaveBeenCalled();
    expect(notifier.failed).toHaveBeenCalledWith('write');
  });

  it('POST: a successful manual retry reports a "write" success (clears the failed-write notice)', async () => {
    let calls = 0;
    const { notifier, wrapped } = setup(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(httpError(504)) : Promise.resolve({ ok: true });
    });

    await wrapped('/api/appointments', { method: 'POST' }).catch(() => undefined);
    await expect(wrapped('/api/appointments', { method: 'POST' })).resolves.toEqual({ ok: true });

    expect(notifier.failed).toHaveBeenCalledWith('write');
    expect(notifier.succeeded).toHaveBeenCalledWith('write');
  });

  it('rethrows real errors untouched (401 keeps the refresh flow working)', async () => {
    const err401 = httpError(401);
    const { fetcher, notifier, wrapped } = setup(() => Promise.reject(err401));

    await expect(wrapped('/api/clients')).rejects.toBe(err401);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(notifier.waking).not.toHaveBeenCalled();
    expect(notifier.failed).not.toHaveBeenCalled();
  });

  it('passes non-API requests through without any handling', async () => {
    const err = httpError(503);
    const { fetcher, notifier, wrapped } = setup(() => Promise.reject(err));

    await expect(wrapped('https://maps.example.com/tiles')).rejects.toBe(err);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(notifier.failed).not.toHaveBeenCalled();
  });

  it('preserves default transient retries while routing proxy retries through wrapper backoff', async () => {
    const transport = vi
      .fn<TestFetcher>()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ ok: true });
    const { notifier, sleep, wrapped } = setupFetcher(withDefaultGetRetry(transport));

    await expect(wrapped('/api/tenants/salon', { method: 'GET' })).resolves.toEqual({ ok: true });

    expect(transport).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map((call) => (call as unknown[])[0])).toEqual([3000]);
    for (const [, options] of transport.mock.calls) {
      expect([undefined, 1]).toContain(options?.retry);
      expect(options?.retryStatusCodes).toEqual(expect.arrayContaining([408, 409, 425, 429, 500]));
      expect(options?.retryStatusCodes).not.toContain(502);
      expect(options?.retryStatusCodes).not.toContain(503);
      expect(options?.retryStatusCodes).not.toContain(504);
    }
    expect(notifier.waking).toHaveBeenCalledTimes(1);
    expect(notifier.recovered).toHaveBeenCalledTimes(1);
    expect(notifier.failed).not.toHaveBeenCalled();
  });

  it.each([408, 409, 425, 429, 500])(
    'keeps the default single GET retry for transient HTTP %s responses',
    async (status) => {
      const transport = vi
        .fn<TestFetcher>()
        .mockRejectedValueOnce(httpError(status))
        .mockResolvedValueOnce({ ok: true });
      const { notifier, sleep, wrapped } = setupFetcher(withDefaultGetRetry(transport));

      await expect(wrapped('/api/appointments')).resolves.toEqual({ ok: true });

      expect(transport).toHaveBeenCalledTimes(2);
      expect(sleep).not.toHaveBeenCalled();
      expect(notifier.waking).not.toHaveBeenCalled();
      expect(notifier.failed).not.toHaveBeenCalled();
    },
  );

  it.each([502, 503, 504])(
    'keeps proxy HTTP %s retries within the wrapper backoff even with a caller retry option',
    async (status) => {
      const transport = vi.fn<TestFetcher>().mockRejectedValue(httpError(status));
      const { notifier, sleep, wrapped } = setupFetcher(withDefaultGetRetry(transport));

      const err = await wrapped('/api/tenants/me', { retry: 2 }).catch((error: unknown) => error);

      expect(err).toBeInstanceOf(ColdStartError);
      expect(transport).toHaveBeenCalledTimes(COLD_START_MAX_RETRIES + 1);
      expect(sleep.mock.calls.map((call) => (call as unknown[])[0])).toEqual([3000, 6000, 12_000]);
      expect(notifier.waking).toHaveBeenCalledTimes(COLD_START_MAX_RETRIES);
      expect(notifier.failed).toHaveBeenCalledWith('read');
    },
  );

  it('respects a caller-supplied retry count for transient GET responses', async () => {
    const transport = vi
      .fn<TestFetcher>()
      .mockRejectedValueOnce(httpError(500))
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce({ ok: true });
    const { notifier, wrapped } = setupFetcher(withDefaultGetRetry(transport));

    await expect(wrapped('/api/appointments', { retry: 2 })).resolves.toEqual({ ok: true });

    expect(transport).toHaveBeenCalledTimes(3);
    expect(transport.mock.calls[0]?.[1]).toMatchObject({ retry: 2 });
    expect(notifier.waking).not.toHaveBeenCalled();
    expect(notifier.failed).not.toHaveBeenCalled();
  });
});

describe('isApiUrl', () => {
  it('matches the API base and its sub-paths only', () => {
    expect(isApiUrl('/api', '/api')).toBe(true);
    expect(isApiUrl('/api/public/salon', '/api')).toBe(true);
    expect(isApiUrl('/api?x=1', '/api/')).toBe(true);
    expect(isApiUrl('http://localhost:3000/auth/me', 'http://localhost:3000')).toBe(true);
    expect(isApiUrl('/apiary', '/api')).toBe(false);
    expect(isApiUrl('/_payload.json', '/api')).toBe(false);
    expect(isApiUrl(new Request('http://x/api'), '/api')).toBe(false);
    expect(isApiUrl('/api/x', '')).toBe(false);
  });
});

describe('noticePhaseAfterSuccess', () => {
  it('a successful write clears a stale failed-write notice', () => {
    expect(noticePhaseAfterSuccess('failed-write', 'write')).toBe('hidden');
  });

  it('a successful read does not hide a failed-write notice the user has not seen resolved', () => {
    expect(noticePhaseAfterSuccess('failed-write', 'read')).toBe('failed-write');
  });

  it('any success clears "waking"; failed-read and hidden stay as they are', () => {
    expect(noticePhaseAfterSuccess('waking', 'read')).toBe('hidden');
    expect(noticePhaseAfterSuccess('waking', 'write')).toBe('hidden');
    expect(noticePhaseAfterSuccess('failed-read', 'read')).toBe('hidden');
    expect(noticePhaseAfterSuccess('failed-read', 'write')).toBe('hidden');
    expect(noticePhaseAfterSuccess('hidden', 'read')).toBe('hidden');
  });
});
