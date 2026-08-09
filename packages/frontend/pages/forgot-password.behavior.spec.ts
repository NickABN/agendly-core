// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { ref } from 'vue';
import ForgotPassword from './forgot-password.vue';

// --- Nuxt auto-import stubs (the page compiles to free identifiers) ---

const fetchMock = vi.fn();

vi.stubGlobal('ref', ref);
vi.stubGlobal('definePageMeta', () => {});
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiUrl: 'http://api.test' } }));
vi.stubGlobal('$fetch', fetchMock);

function mountPage() {
  return mount(ForgotPassword, {
    global: { components: { NuxtLink: RouterLinkStub } },
  });
}

async function submitEmail(wrapper: ReturnType<typeof mountPage>, email: string) {
  if (email) await wrapper.find('#email').setValue(email);
  await wrapper.find('form').trigger('submit.prevent');
  await flushPromises();
}

describe('forgot-password page behavior', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('posts the email to /auth/forgot-password and shows the check-your-inbox state', async () => {
    fetchMock.mockResolvedValueOnce({});
    const wrapper = mountPage();

    await submitEmail(wrapper, 'dueno@salon.mx');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/auth/forgot-password', {
      method: 'POST',
      body: { email: 'dueno@salon.mx' },
    });
    // Anti-enumeration: a 200 always means "check your inbox", echoing the email.
    expect(wrapper.text()).toContain('¡Revisa tu correo!');
    expect(wrapper.text()).toContain('dueno@salon.mx');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('shows the retry message on a network/server failure and stays on the form', async () => {
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));
    const wrapper = mountPage();

    await submitEmail(wrapper, 'dueno@salon.mx');

    expect(wrapper.text()).toContain(
      'No pudimos procesar tu solicitud. Intenta de nuevo en unos momentos.',
    );
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('¡Revisa tu correo!');
  });

  it('does not call the API when the email is empty (guard, not just HTML required)', async () => {
    const wrapper = mountPage();

    // jsdom does not enforce `required`, so this exercises the JS guard itself.
    await submitEmail(wrapper, '');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('recovers after a failure: a successful retry reaches the success state', async () => {
    fetchMock.mockRejectedValueOnce(new Error('fetch failed')).mockResolvedValueOnce({});
    const wrapper = mountPage();

    await submitEmail(wrapper, 'dueno@salon.mx');
    expect(wrapper.find('form').exists()).toBe(true);

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('¡Revisa tu correo!');
  });
});
