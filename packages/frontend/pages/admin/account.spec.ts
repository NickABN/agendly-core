// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import AccountPage from './account.vue';

function mountAccountPage(deletionScheduledAt: string | null) {
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('onUnmounted', onUnmounted);
  vi.stubGlobal('definePageMeta', () => {});

  const store = reactive({
    user: { role: 'OWNER', email: 'owner@salon.mx' },
    tenant: { name: 'Salón Calma', slug: 'salon-calma' },
    deletionScheduledAt,
  });
  const accountDeletion = {
    status: ref(null),
    loading: ref(false),
    error: ref(''),
    load: vi.fn(),
    requestDeletion: vi.fn(),
    cancelDeletion: vi.fn().mockResolvedValue(true),
  };
  vi.stubGlobal('useAuth', () => ({ store, logout: vi.fn() }));
  vi.stubGlobal('useBusinessTimezone', () => ref('America/Mexico_City'));
  vi.stubGlobal('useAccountDeletion', () => accountDeletion);

  const wrapper = mount(AccountPage, {
    global: { components: { NuxtLink: RouterLinkStub } },
  });
  return { wrapper, accountDeletion };
}

function findReactivationButton(wrapper: ReturnType<typeof mountAccountPage>['wrapper']) {
  return wrapper.findAll('button').find((button) => button.text().trim().startsWith('Reactivar'));
}

describe('admin account deletion deadline', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('blocks reactivation after the deadline, explains the purge, and keeps it available before', async () => {
    const pastDeadline = new Date(Date.now() - 60_000).toISOString();
    const expired = mountAccountPage(pastDeadline);
    const expiredButton = findReactivationButton(expired.wrapper);

    expect(expiredButton === undefined || expiredButton.attributes('disabled') !== undefined).toBe(
      true,
    );
    const deadlineNotice = expired.wrapper.find('[role="status"], [role="alert"]');
    expect(deadlineNotice.exists()).toBe(true);
    expect(deadlineNotice.text()).toMatch(/plazo.*(venci|termin|pasó)/i);
    expect(deadlineNotice.text()).toMatch(/(eliminar|borrar).*(breve|pronto)/i);
    expect(expired.accountDeletion.cancelDeletion).not.toHaveBeenCalled();

    expired.wrapper.unmount();

    const futureDeadline = new Date(Date.now() + 86_400_000).toISOString();
    const pending = mountAccountPage(futureDeadline);
    const pendingButton = findReactivationButton(pending.wrapper);
    expect(pendingButton).toBeDefined();
    expect(pendingButton?.attributes('disabled')).toBeUndefined();

    await pendingButton?.trigger('click');
    await flushPromises();
    expect(pending.accountDeletion.cancelDeletion).toHaveBeenCalledTimes(1);
  });

  it('hides reactivation and announces the deadline after it passes while mounted', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-15T12:00:00.000Z');
    vi.setSystemTime(start);
    const deadline = new Date(start.getTime() + 60_000);
    const { wrapper } = mountAccountPage(deadline.toISOString());

    expect(findReactivationButton(wrapper)).toBeDefined();

    await vi.advanceTimersByTimeAsync(60_001);
    await nextTick();

    expect(findReactivationButton(wrapper)).toBeUndefined();
    expect(wrapper.get('[role="status"]').text()).toContain(
      'El plazo para reactivar tu cuenta ya venció.',
    );

    wrapper.unmount();
  });

  it.each([
    ['without a pending deletion', null],
    ['when the deadline has already passed', '2026-01-15T11:59:59.000Z'],
  ])('does not schedule a timer %s', (_, deletionScheduledAt) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    const { wrapper } = mountAccountPage(deletionScheduledAt);

    expect(vi.getTimerCount()).toBe(0);

    wrapper.unmount();
  });

  it('clears the deadline timer when unmounted', () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-15T12:00:00.000Z');
    vi.setSystemTime(start);
    const deadline = new Date(start.getTime() + 60_000);
    const { wrapper } = mountAccountPage(deadline.toISOString());

    expect(vi.getTimerCount()).toBe(1);

    wrapper.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the API message and refreshes status when reactivation is rejected', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-15T12:00:00.000Z');
    vi.setSystemTime(start);
    const { wrapper, accountDeletion } = mountAccountPage(
      new Date(start.getTime() + 60_000).toISOString(),
    );
    const apiMessage = 'El plazo para reactivar la cuenta ya venció.';
    accountDeletion.cancelDeletion.mockImplementationOnce(async () => {
      accountDeletion.error.value = apiMessage;
      return false;
    });

    await findReactivationButton(wrapper)?.trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(apiMessage);
    expect(accountDeletion.load).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });
});
