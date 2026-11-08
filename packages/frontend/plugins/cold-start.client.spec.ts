import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiUrl = 'https://api.example.test';
const notifier = {
  waking: vi.fn(),
  recovered: vi.fn(),
  failed: vi.fn(),
  succeeded: vi.fn(),
};
const defineNuxtPluginMock = vi.fn((plugin: () => void) => plugin);
vi.stubGlobal('defineNuxtPlugin', defineNuxtPluginMock);

const { default: coldStartPlugin } = await import('./cold-start.client');

function httpError(status: number) {
  return Object.assign(new Error(String(status)), {
    name: 'FetchError',
    statusCode: status,
    response: { status },
  });
}

describe('cold-start client plugin integration', () => {
  let globalFetcher: ReturnType<typeof vi.fn>;
  let rawFetcher: ReturnType<typeof vi.fn>;
  let clientFetcher: ReturnType<typeof vi.fn>;
  let createFetcher: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    notifier.waking.mockClear();
    notifier.recovered.mockClear();
    notifier.failed.mockClear();
    notifier.succeeded.mockClear();

    globalFetcher = vi.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValue({ ok: true });
    rawFetcher = vi.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValue({ raw: true });
    clientFetcher = vi
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValue({ client: true });

    createFetcher = vi.fn(() => clientFetcher);
    const fetchWithMethods = Object.assign(globalFetcher, {
      raw: rawFetcher,
      native: vi.fn(),
      create: createFetcher,
    });
    vi.stubGlobal('$fetch', fetchWithMethods);
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiUrl } }));
    vi.stubGlobal('useColdStartNotice', () => ({ notifier }));
    coldStartPlugin({} as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('wraps global, raw, and API-base $fetch calls with one bounded retry policy', async () => {
    const tenantUrl = `${apiUrl}/public/salon-calma`;
    const globalRequest = globalThis.$fetch(tenantUrl);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(globalRequest).resolves.toEqual({ ok: true });

    const rawRequest = globalThis.$fetch.raw(tenantUrl);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(rawRequest).resolves.toEqual({ raw: true });

    const apiClient = globalThis.$fetch.create({ baseURL: apiUrl });
    const clientRequest = apiClient('/public/salon-calma');
    await vi.advanceTimersByTimeAsync(3000);
    await expect(clientRequest).resolves.toEqual({ client: true });

    expect(globalFetcher).toHaveBeenCalledTimes(2);
    expect(rawFetcher).toHaveBeenCalledTimes(2);
    expect(clientFetcher).toHaveBeenCalledTimes(2);
    expect(globalFetcher.mock.calls.map((call) => call[1]?.retry)).toEqual([0, 0]);
    expect(rawFetcher.mock.calls.map((call) => call[1]?.retry)).toEqual([0, 0]);
    expect(clientFetcher.mock.calls.map((call) => call[1]?.retry)).toEqual([0, 0]);
    expect(notifier.recovered).toHaveBeenCalledTimes(3);
    expect(notifier.succeeded).toHaveBeenCalledTimes(3);
  });

  it('does not apply the API policy to a client with a different base URL', async () => {
    const otherClient = vi.fn().mockRejectedValue(httpError(503));
    createFetcher.mockReturnValueOnce(otherClient);
    const client = globalThis.$fetch.create({ baseURL: 'https://other.example.test' });

    await expect(client('/public/salon-calma')).rejects.toMatchObject({ statusCode: 503 });

    expect(otherClient).toHaveBeenCalledTimes(1);
    expect(otherClient).toHaveBeenCalledWith('/public/salon-calma', undefined);
    expect(notifier.failed).not.toHaveBeenCalled();
  });
});
