// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { ref, computed } from 'vue';
import ResetPassword from './reset-password.vue';

// --- Nuxt auto-import stubs (the page compiles to free identifiers) ---

const fetchMock = vi.fn();
let routeQuery: Record<string, unknown> = {};

vi.stubGlobal('ref', ref);
vi.stubGlobal('computed', computed);
vi.stubGlobal('definePageMeta', () => {});
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiUrl: 'http://api.test' } }));
vi.stubGlobal('useRoute', () => ({ query: routeQuery }));
vi.stubGlobal('$fetch', fetchMock);

function mountPage() {
  return mount(ResetPassword, {
    global: { components: { NuxtLink: RouterLinkStub } },
  });
}

async function submitPasswords(
  wrapper: ReturnType<typeof mountPage>,
  password: string,
  confirmation: string,
) {
  await wrapper.find('#password').setValue(password);
  await wrapper.find('#confirmPassword').setValue(confirmation);
  await wrapper.find('form').trigger('submit.prevent');
  await flushPromises();
}

describe('reset-password page behavior', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    routeQuery = { token: 'valid-token-123' };
  });

  it('shows the invalid-link state and no form when the token is missing', () => {
    routeQuery = {};
    const wrapper = mountPage();

    expect(wrapper.text()).toContain('Enlace inválido');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a non-string token (repeated query param) as missing', () => {
    routeQuery = { token: ['a', 'b'] };
    const wrapper = mountPage();

    expect(wrapper.text()).toContain('Enlace inválido');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('submits { token, password } to the reset endpoint and renders the success state', async () => {
    fetchMock.mockResolvedValueOnce({});
    const wrapper = mountPage();

    await submitPasswords(wrapper, 'newpassword1', 'newpassword1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/auth/reset-password', {
      method: 'POST',
      body: { token: 'valid-token-123', password: 'newpassword1' },
    });
    expect(wrapper.text()).toContain('¡Contraseña actualizada!');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('blocks submission client-side when the confirmation does not match', async () => {
    const wrapper = mountPage();

    await submitPasswords(wrapper, 'newpassword1', 'different-pass');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').text()).toContain('Las contraseñas no coinciden');
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('renders the backend Spanish message from a 400 response and stays on the form', async () => {
    fetchMock.mockRejectedValueOnce({
      data: { message: 'El enlace de recuperación ya fue utilizado' },
    });
    const wrapper = mountPage();

    await submitPasswords(wrapper, 'newpassword1', 'newpassword1');

    expect(wrapper.find('[role="alert"]').text()).toContain(
      'El enlace de recuperación ya fue utilizado',
    );
    // The user can retry or request a new link — the form is still there.
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('¡Contraseña actualizada!');
  });

  it('falls back to a generic retry message when the failure carries no backend message', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const wrapper = mountPage();

    await submitPasswords(wrapper, 'newpassword1', 'newpassword1');

    expect(wrapper.find('[role="alert"]').text()).toContain(
      'No pudimos restablecer tu contraseña. Intenta de nuevo.',
    );
    expect(wrapper.find('form').exists()).toBe(true);
  });
});
