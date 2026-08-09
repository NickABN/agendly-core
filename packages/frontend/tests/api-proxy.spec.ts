import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyRequestMock = vi.fn();
const removeResponseHeaderMock = vi.fn();
const fetchMock = vi.fn<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>(() => Promise.resolve(new Response(null, { status: 204 })));

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
vi.stubGlobal('useRuntimeConfig', () => ({
  apiProxyTarget: 'https://agendly-backend-u9tt.onrender.com',
}));
vi.stubGlobal('getRequestURL', () =>
  new URL('https://agendly-admin1.netlify.app/api/auth/refresh?source=ssr'),
);
vi.stubGlobal('getRequestHeader', (_event: unknown, name: string) =>
  name === 'accept'
    ? 'application/json'
    : name === 'connection'
      ? 'keep-alive, x-request-only'
      : undefined,
);
vi.stubGlobal('proxyRequest', proxyRequestMock);
vi.stubGlobal('removeResponseHeader', removeResponseHeaderMock);
vi.stubGlobal('fetch', fetchMock);

const { buildApiProxyTarget, default: handler } = await import(
  '../server/routes/api/[...path]'
);

describe('same-origin API proxy', () => {
  beforeEach(() => {
    proxyRequestMock.mockReset();
    removeResponseHeaderMock.mockReset();
    fetchMock.mockClear();
  });

  it('always keeps the configured upstream host', () => {
    const target = buildApiProxyTarget(
      'https://agendly-backend-u9tt.onrender.com',
      new URL('https://agendly-admin1.netlify.app/api//attacker.example/path?x=1'),
    );

    expect(new URL(target).origin).toBe('https://agendly-backend-u9tt.onrender.com');
    expect(new URL(target).pathname).toBe('//attacker.example/path');
  });

  it(
    'passes redirects through and preserves both cookies with the proxied auth path',
    async () => {
      const responseCookies = [
        'agendly_token=access; Path=/; HttpOnly; Secure',
        'agendly_refresh=refresh; Path=/auth; HttpOnly; Secure',
      ];
      proxyRequestMock.mockImplementation((_event, _target, options) => {
        const rewritten = responseCookies.map((cookie) =>
          cookie.replace('Path=/auth', `Path=${options.cookiePathRewrite['/auth']}`),
        );
        return { status: 302, headers: { location: '/next', 'set-cookie': rewritten } };
      });

      const response = await handler({} as never);
      const [, target, options] = proxyRequestMock.mock.calls[0];

      expect(target).toBe('https://agendly-backend-u9tt.onrender.com/auth/refresh?source=ssr');
      expect(options.fetchOptions).toEqual({ redirect: 'manual' });
      expect(options.headers).toEqual({ accept: 'application/json' });
      expect(response.headers['set-cookie']).toEqual([
        'agendly_token=access; Path=/; HttpOnly; Secure',
          'agendly_refresh=refresh; Path=/; HttpOnly; Secure',
      ]);

      await options.fetch(target, {
        headers: {
          'proxy-authorization': 'secret',
          'x-request-only': 'drop-me',
          'x-safe': 'preserve-me',
        },
      });
      const fetchInit = fetchMock.mock.calls[0]?.[1];
      if (!fetchInit) throw new Error('Proxy fetch was not called with init options');
      const forwardedHeaders = new Headers(fetchInit.headers);
      expect(forwardedHeaders.get('proxy-authorization')).toBeNull();
      expect(forwardedHeaders.get('x-request-only')).toBeNull();
      expect(forwardedHeaders.get('x-safe')).toBe('preserve-me');

      options.onResponse(
        {},
        new Response(null, { headers: { connection: 'keep-alive, x-upstream-only' } }),
      );
      expect(removeResponseHeaderMock).toHaveBeenCalledWith({}, 'connection');
      expect(removeResponseHeaderMock).toHaveBeenCalledWith({}, 'transfer-encoding');
      expect(removeResponseHeaderMock).toHaveBeenCalledWith({}, 'x-upstream-only');
    },
  );
});
