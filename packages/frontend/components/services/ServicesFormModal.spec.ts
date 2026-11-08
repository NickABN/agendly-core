// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import ServicesFormModal from './ServicesFormModal.vue';

let mountedWrappers: VueWrapper[] = [];

function mountModal() {
  const wrapper = mount(ServicesFormModal, {
    props: { open: true, editing: null },
    attachTo: document.body,
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  mountedWrappers = [];
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('watch', watch);
});

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('ServicesFormModal duration select', () => {
  it('renders a styled listbox trigger associated with the duration label', async () => {
    mountModal();
    await nextTick();

    const label = document.querySelector('label[for="service-duration"]');
    expect(label?.textContent).toContain('Duración');

    const trigger = document.querySelector('#service-duration');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('submits a numeric duration chosen through the listbox', async () => {
    const wrapper = mountModal();
    await nextTick();

    // Fill the required name so submit is allowed.
    const nameInput = document.querySelector<HTMLInputElement>('#service-name');
    expect(nameInput).toBeTruthy();
    nameInput!.value = 'Corte de cabello';
    nameInput!.dispatchEvent(new Event('input'));
    await nextTick();

    // Open the styled duration listbox and pick an option.
    document.querySelector<HTMLElement>('#service-duration')!.click();
    await nextTick();

    const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options.length).toBeGreaterThan(0);

    // Pick the option labelled "1 h" (60 minutes) from the shared onboarding set.
    const sixty = options.find((option) => option.textContent?.trim() === '1 h');
    expect(sixty).toBeTruthy();
    sixty!.click();
    await nextTick();

    document
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await nextTick();

    const emitted = wrapper.emitted('submit');
    expect(emitted).toBeTruthy();
    const payload = emitted?.[0]?.[0] as { durationMinutes: number };
    expect(payload.durationMinutes).toBe(60);
    expect(typeof payload.durationMinutes).toBe('number');
  });
});
