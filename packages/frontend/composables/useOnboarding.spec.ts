import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Módulo mocks (hoisted) ---

const { setTenantMock } = vi.hoisted(() => ({ setTenantMock: vi.fn() }));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ setTenant: setTenantMock }),
}));

// --- Stubs de auto-imports de Nuxt ---

const apiMock = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
};

vi.stubGlobal('useApi', () => apiMock);

const { useOnboarding } = await import('./useOnboarding');

// Weekly editor shape as edited by the user in onboarding step 4 (Monday-first).
const weekDays = [
  { name: 'Lunes', enabled: true, start: '10:00', end: '19:00' },
  { name: 'Martes', enabled: true, start: '09:30', end: '18:30' },
  { name: 'Miércoles', enabled: false, start: '09:00', end: '18:00' },
  { name: 'Jueves', enabled: true, start: '09:00', end: '18:00' },
  { name: 'Viernes', enabled: true, start: '09:00', end: '20:00' },
  { name: 'Sábado', enabled: true, start: '10:00', end: '14:00' },
  { name: 'Domingo', enabled: false, start: '09:00', end: '18:00' },
];

describe('useOnboarding.saveSchedules', () => {
  beforeEach(() => {
    apiMock.put.mockReset().mockResolvedValue([]);
  });

  it('sends one bulk PUT per employee with the user-edited hours', async () => {
    const onboarding = useOnboarding();

    await onboarding.saveSchedules(['emp-1', 'emp-2'], weekDays);

    expect(apiMock.put).toHaveBeenCalledTimes(2);
    const expectedDays = [
      { dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '19:00' },
      { dayOfWeek: 'TUESDAY', startTime: '09:30', endTime: '18:30' },
      { dayOfWeek: 'THURSDAY', startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 'FRIDAY', startTime: '09:00', endTime: '20:00' },
      { dayOfWeek: 'SATURDAY', startTime: '10:00', endTime: '14:00' },
    ];
    expect(apiMock.put).toHaveBeenNthCalledWith(1, '/schedules/bulk', {
      employeeId: 'emp-1',
      days: expectedDays,
    });
    expect(apiMock.put).toHaveBeenNthCalledWith(2, '/schedules/bulk', {
      employeeId: 'emp-2',
      days: expectedDays,
    });
  });

  it('omits disabled days so the bulk replace leaves them closed', async () => {
    const onboarding = useOnboarding();

    await onboarding.saveSchedules(['emp-1'], weekDays);

    const { days } = apiMock.put.mock.calls[0][1];
    const sentDays = days.map((d: { dayOfWeek: string }) => d.dayOfWeek);
    expect(sentDays).not.toContain('WEDNESDAY');
    expect(sentDays).not.toContain('SUNDAY');
  });

  it('sends an empty days array when every day is disabled (fully closed)', async () => {
    const onboarding = useOnboarding();
    const allClosed = weekDays.map((d) => ({ ...d, enabled: false }));

    await onboarding.saveSchedules(['emp-1'], allClosed);

    expect(apiMock.put).toHaveBeenCalledWith('/schedules/bulk', {
      employeeId: 'emp-1',
      days: [],
    });
  });

  it('does nothing when there are no employees', async () => {
    const onboarding = useOnboarding();

    await onboarding.saveSchedules([], weekDays);

    expect(apiMock.put).not.toHaveBeenCalled();
  });

  describe('partial failure across employees', () => {
    beforeEach(() => {
      apiMock.post.mockReset();
      setTenantMock.mockReset();
    });

    it('rejects and stops at the failing employee, so onboarding is never completed', async () => {
      // onboarding.vue step 4 runs `await saveSchedules(...)` BEFORE
      // `await completeOnboarding()`, so a rejection here is what prevents the
      // tenant from being marked as onboarded with half-saved schedules.
      const bulkError = new Error('500 Internal Server Error');
      apiMock.put
        .mockResolvedValueOnce([]) // emp-1 succeeds
        .mockRejectedValueOnce(bulkError); // emp-2 fails

      const onboarding = useOnboarding();

      await expect(onboarding.saveSchedules(['emp-1', 'emp-2', 'emp-3'], weekDays)).rejects.toThrow(
        bulkError,
      );

      // emp-3 is never contacted: the loop is sequential and aborts on failure.
      expect(apiMock.put).toHaveBeenCalledTimes(2);
      expect(apiMock.put.mock.calls[0][1].employeeId).toBe('emp-1');
      expect(apiMock.put.mock.calls[1][1].employeeId).toBe('emp-2');

      // completeOnboarding (POST /tenant/complete-onboarding → setTenant) never ran.
      expect(apiMock.post).not.toHaveBeenCalled();
      expect(setTenantMock).not.toHaveBeenCalled();
    });

    it('retrying after a partial failure re-sends the already-saved employee identically', async () => {
      // PUT /schedules/bulk is a full replace per employee, so retrying the
      // whole step is idempotent: emp-1 (already saved on attempt 1) receives
      // exactly the same payload again instead of a diff. This test documents
      // that assumption — if the endpoint ever becomes append-only, retrying
      // the onboarding step would duplicate schedules and this must change.
      apiMock.put
        .mockResolvedValueOnce([]) // attempt 1: emp-1 succeeds
        .mockRejectedValueOnce(new Error('network error')); // attempt 1: emp-2 fails

      const onboarding = useOnboarding();

      await expect(onboarding.saveSchedules(['emp-1', 'emp-2'], weekDays)).rejects.toThrow(
        'network error',
      );
      const firstAttemptEmp1 = apiMock.put.mock.calls[0];

      apiMock.put.mockClear().mockResolvedValue([]); // attempt 2: server recovered
      await onboarding.saveSchedules(['emp-1', 'emp-2'], weekDays);

      expect(apiMock.put).toHaveBeenCalledTimes(2);
      // emp-1's retry payload is byte-for-byte the payload of the first attempt.
      expect(apiMock.put.mock.calls[0]).toEqual(firstAttemptEmp1);
      expect(apiMock.put.mock.calls[1][1].employeeId).toBe('emp-2');
    });
  });
});
