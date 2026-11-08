// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { reactive, ref, computed } from 'vue';
import Login from './login.vue';

// ---------------------------------------------------------------------------
// S4 — The login page shows a friendly message when the Google OAuth callback
// redirected back with ?error=google. Without that query param, no Google error
// message is shown.
// ---------------------------------------------------------------------------

const GOOGLE_ERROR =
  'No pudimos iniciar sesión con Google. Intenta de nuevo o usa tu correo y contraseña.';

const loginMock = vi.fn();
const loginWithGoogleMock = vi.fn();
const navigateToMock = vi.fn();
let routeQuery: Record<string, string | undefined> = {};

vi.stubGlobal('ref', ref);
vi.stubGlobal('reactive', reactive);
vi.stubGlobal('computed', computed);
vi.stubGlobal('definePageMeta', () => {});
vi.stubGlobal('navigateTo', navigateToMock);
vi.stubGlobal('useAuth', () => ({
  login: loginMock,
  loginWithGoogle: loginWithGoogleMock,
}));
vi.stubGlobal('useRoute', () => ({ query: routeQuery }));

function mountPage() {
  return mount(Login, {
    global: { components: { NuxtLink: RouterLinkStub } },
  });
}

describe('login page — Google OAuth error message (S4)', () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginWithGoogleMock.mockReset();
    navigateToMock.mockReset();
    routeQuery = {};
  });

  it('shows the friendly Google error when ?error=google is present', () => {
    routeQuery = { error: 'google' };
    const wrapper = mountPage();
    expect(wrapper.text()).toContain(GOOGLE_ERROR);
  });

  it('does not show the Google error message without the query param', () => {
    routeQuery = {};
    const wrapper = mountPage();
    expect(wrapper.text()).not.toContain(GOOGLE_ERROR);
  });
});
