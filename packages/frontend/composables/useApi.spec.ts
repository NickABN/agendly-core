import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks de módulos (hoisted) ---

const { clearMock } = vi.hoisted(() => ({ clearMock: vi.fn() }));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ clear: clearMock }),
}));

vi.mock('@sentry/vue', () => ({ captureException: vi.fn() }));

// --- Stubs de auto-imports de Nuxt ---

const navigateToMock = vi.fn();
const apiUrl = 'http://localhost:3000';

// `$fetch` es a la vez función (refresh directo) y tiene `.create` (cliente base).
const client = vi.fn();
const $fetchMock = Object.assign(vi.fn(), { create: vi.fn(() => client) });

vi.stubGlobal('apiBase', () => apiUrl);
vi.stubGlobal('useRequestHeaders', () => ({}));
vi.stubGlobal('navigateTo', navigateToMock);
vi.stubGlobal('$fetch', $fetchMock);

const { useApi } = await import('./useApi');

const err401 = { response: { status: 401 } };

describe('useApi — interceptor de refresh', () => {
  beforeEach(() => {
    client.mockReset();
    $fetchMock.mockReset();
    navigateToMock.mockReset();
    clearMock.mockReset();
  });

  it('varios 401 concurrentes disparan UN solo refresh (single-flight)', async () => {
    let calls = 0;
    client.mockImplementation(() => {
      calls += 1;
      // Las 2 primeras llamadas (una por request) fallan con 401; los reintentos pasan.
      return calls <= 2
        ? Promise.reject(err401)
        : Promise.resolve({ ok: true });
    });
    $fetchMock.mockResolvedValue({}); // refresh OK

    const api = useApi();
    const [r1, r2] = await Promise.all([
      api.get('/a'),
      api.get('/b'),
    ]);

    expect($fetchMock).toHaveBeenCalledTimes(1); // un solo /auth/refresh
    expect($fetchMock).toHaveBeenCalledWith(
      '/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
  });

  it('401 → refresh OK → reintenta UNA vez y resuelve', async () => {
    client
      .mockRejectedValueOnce(err401)
      .mockResolvedValueOnce({ data: 42 });
    $fetchMock.mockResolvedValue({});

    const api = useApi();
    const res = await api.get('/x');

    expect(res).toEqual({ data: 42 });
    expect(client).toHaveBeenCalledTimes(2); // original + 1 reintento
  });

  it('refresh falla → limpia sesión, va a /login y NO entra en loop', async () => {
    client.mockRejectedValue(err401);
    $fetchMock.mockRejectedValue(new Error('refresh failed'));

    const api = useApi();
    await expect(api.get('/y')).rejects.toBeDefined();

    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(navigateToMock).toHaveBeenCalledWith('/login');
    expect(client).toHaveBeenCalledTimes(1); // sin reintento (refresh falló)
  });

  it('un 401 en /auth/login NO dispara refresh (no recursa)', async () => {
    client.mockRejectedValue(err401);

    const api = useApi();
    await expect(api.post('/auth/login', {})).rejects.toBeDefined();

    expect($fetchMock).not.toHaveBeenCalled();
    expect(client).toHaveBeenCalledTimes(1);
  });
});
