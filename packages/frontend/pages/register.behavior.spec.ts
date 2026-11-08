// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import Register from './register.vue';

// --- Nuxt auto-import stubs (the page compiles to free identifiers) ---

const registerMock = vi.fn();
const loginWithGoogleMock = vi.fn();
const navigateToMock = vi.fn();

vi.stubGlobal('ref', ref);
vi.stubGlobal('reactive', reactive);
vi.stubGlobal('definePageMeta', () => {});
vi.stubGlobal('navigateTo', navigateToMock);
vi.stubGlobal('useAuth', () => ({
  register: registerMock,
  loginWithGoogle: loginWithGoogleMock,
}));

function mountPage() {
  return mount(Register, {
    global: { components: { NuxtLink: RouterLinkStub } },
  });
}

async function fillForm(wrapper: ReturnType<typeof mountPage>) {
  await wrapper.find('#ownerName').setValue('María');
  await wrapper.find('#businessName').setValue('Bellas Nails');
  await wrapper.find('#email').setValue('hola@bellas.mx');
  await wrapper.find('#password').setValue('secreta123');
}

describe('register page — terms acceptance placement and behavior', () => {
  beforeEach(() => {
    registerMock.mockReset();
    loginWithGoogleMock.mockReset();
    navigateToMock.mockReset();
  });

  it('renders the terms checkbox inside the form, right above the submit button', () => {
    const wrapper = mountPage();
    const form = wrapper.find('form');
    const checkbox = form.find('input[type="checkbox"]');
    expect(checkbox.exists()).toBe(true);

    const submitBlock = form.find('button[type="submit"]').element.parentElement;
    const termsLabel = checkbox.element.closest('label');
    expect(termsLabel?.nextElementSibling).toBe(submitBlock);
  });

  it('blocks email registration until the terms are accepted', async () => {
    const wrapper = mountPage();
    await fillForm(wrapper);

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(registerMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(
      'Para continuar, acepta los Términos y el Aviso de Privacidad.',
    );
  });

  it('registers with acceptedTerms: true once the box is checked', async () => {
    registerMock.mockResolvedValueOnce(undefined);
    const wrapper = mountPage();
    await fillForm(wrapper);
    await wrapper.find('input[type="checkbox"]').setValue(true);

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(registerMock).toHaveBeenCalledWith({
      businessName: 'Bellas Nails',
      ownerName: 'María',
      email: 'hola@bellas.mx',
      password: 'secreta123',
      acceptedTerms: true,
    });
    expect(navigateToMock).toHaveBeenCalledWith('/onboarding');
  });

  it('still requires the terms before Google sign-up', async () => {
    const wrapper = mountPage();
    const google = wrapper.findAll('button').find((b) => b.text().includes('Google'));

    await google!.trigger('click');
    expect(loginWithGoogleMock).not.toHaveBeenCalled();

    await wrapper.find('input[type="checkbox"]').setValue(true);
    await google!.trigger('click');
    expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
  });
});
