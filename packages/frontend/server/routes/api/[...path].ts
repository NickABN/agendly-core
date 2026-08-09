import { validateApiProxyTarget } from '../../../config/runtime-config-validation';

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

function connectionTokens(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function fetchWithoutHopByHopHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  extraHeaders: string[],
): Promise<Response> {
  const headers = new Headers(init?.headers);
  for (const header of [...HOP_BY_HOP_HEADERS, ...extraHeaders]) {
    headers.delete(header);
  }
  return fetch(input, { ...init, headers });
}

export function buildApiProxyTarget(upstreamOrigin: string, requestUrl: URL): string {
  const target = new URL(upstreamOrigin);
  target.pathname = requestUrl.pathname.slice('/api'.length) || '/';
  target.search = requestUrl.search;
  return target.toString();
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const upstream = validateApiProxyTarget(config.apiProxyTarget).origin;
  const requestUrl = getRequestURL(event);
  const target = buildApiProxyTarget(upstream, requestUrl);
  const accept = getRequestHeader(event, 'accept');
  const requestConnectionTokens = connectionTokens(getRequestHeader(event, 'connection'));

  return proxyRequest(event, target, {
    headers: accept ? { accept } : undefined,
    fetchOptions: { redirect: 'manual' },
    fetch: (input, init) => fetchWithoutHopByHopHeaders(input, init, requestConnectionTokens),
    // The backend restricts the refresh token to /auth, but the browser only
    // sees the same-origin /api proxy. Make the cookie available to all API
    // calls so refresh works regardless of the proxied endpoint.
    cookiePathRewrite: { '/auth': '/' },
    onResponse(_event, response) {
      const responseConnectionTokens = connectionTokens(
        response.headers.get('connection') ?? undefined,
      );
      for (const header of [...HOP_BY_HOP_HEADERS, ...responseConnectionTokens]) {
        removeResponseHeader(event, header);
      }
    },
  });
});
