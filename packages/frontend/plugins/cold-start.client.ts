import { isApiUrl, withColdStartHandling } from '~/utils/coldStart';

type FetchFn = typeof globalThis.$fetch;

/**
 * Applies the cold-start policy (utils/coldStart.ts) to every `$fetch` call that
 * targets our API, including instances created with `$fetch.create` (useApi).
 * Client-only: on the server `globalThis` is shared across requests, and SSR
 * pages handle a sleeping backend themselves (see usePublicBooking).
 */
export default defineNuxtPlugin(() => {
  const apiUrl = useRuntimeConfig().public.apiUrl;
  const { notifier } = useColdStartNotice();

  function wrap(fetcher: FetchFn, isApiRequest: (request: unknown) => boolean): FetchFn {
    const fetchLike = fetcher as unknown as (
      request: unknown,
      options?: { method?: string; [key: string]: unknown },
    ) => Promise<unknown>;
    const wrapped = withColdStartHandling(fetchLike, { notifier, isApiRequest });
    const wrappedRaw = withColdStartHandling(fetcher.raw as unknown as typeof fetchLike, {
      notifier,
      isApiRequest,
    });
    return Object.assign(wrapped, {
      raw: wrappedRaw as FetchFn['raw'],
      native: (fetcher as unknown as { native?: unknown }).native,
      create: ((defaults, ...rest) => {
        const instance = fetcher.create(defaults, ...rest);
        // An instance whose baseURL is the API (useApi) handles only API calls.
        const forApi = isApiUrl(defaults?.baseURL, apiUrl);
        return wrap(instance, forApi ? () => true : () => false);
      }) as FetchFn['create'],
    }) as unknown as FetchFn;
  }

  globalThis.$fetch = wrap(globalThis.$fetch, (request) => isApiUrl(request, apiUrl));
});
