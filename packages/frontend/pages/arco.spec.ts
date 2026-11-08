// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { reactive, ref, computed } from 'vue';
import Arco from './arco.vue';

let mountedWrappers: VueWrapper[] = [];

const LegalDocumentStub = {
  name: 'LegalDocument',
  template: '<div><slot /></div>',
};

function mountPage() {
  const wrapper = mount(Arco, {
    global: {
      stubs: { LegalDocument: LegalDocumentStub },
    },
    attachTo: document.body,
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  mountedWrappers = [];
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('definePageMeta', () => {});
  vi.stubGlobal('useHead', () => {});
  vi.stubGlobal('useLegalInfo', () => ({
    email: 'privacidad@example.mx',
    emailLabel: 'disponible',
    updatedAt: '2024-01-01',
  }));
});

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('arco page — styled right select', () => {
  it('renders a styled listbox trigger for the right, associated with its label', async () => {
    const wrapper = mountPage();

    const trigger = wrapper.get('#arco-right');
    expect(trigger.attributes('aria-haspopup')).toBe('listbox');

    const label = wrapper.get('label[for="arco-right"]');
    expect(label.text()).toContain('Derecho');
  });

  it('submits the chosen right through the mailto link', async () => {
    const wrapper = mountPage();

    // Fill the required fields so the mailto link becomes active.
    await wrapper.get('input[autocomplete="name"]').setValue('Ada Lovelace');
    const inputs = wrapper.findAll('input');
    // Second text input is the contact field.
    await inputs[1]?.setValue('ada@example.mx');
    await wrapper.get('textarea').setValue('Quiero cancelar mis datos.');

    // Pick "Cancelación" through the styled listbox.
    await wrapper.get('#arco-right').trigger('click');
    const options = wrapper.findAll('[role="option"]');
    const cancel = options.find((option) => option.text().trim() === 'Cancelación');
    expect(cancel).toBeTruthy();
    await cancel?.trigger('click');

    const mailLink = wrapper.get('a[href^="mailto:"]');
    const href = decodeURIComponent(mailLink.attributes('href') ?? '');
    expect(href).toContain('Derecho que ejerzo: Cancelación');
    expect(href).toContain('Solicitud ARCO — Cancelación');
  });
});
