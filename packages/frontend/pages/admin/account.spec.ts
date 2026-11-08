// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { computed, onMounted, reactive, ref } from 'vue';
import AccountPage from './account.vue';

function mountAccountPage(deletionScheduledAt: string) {
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
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
});
