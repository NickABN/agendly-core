// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import OnboardingScheduleEditor from './OnboardingScheduleEditor.vue';

let mountedWrappers: VueWrapper[] = [];

function mountEditor() {
  const wrapper = mount(OnboardingScheduleEditor);
  mountedWrappers.push(wrapper);
  return wrapper;
}

async function addBlock(wrapper: VueWrapper) {
  const addButton = wrapper
    .findAll('button')
    .find((button) => button.text().includes('Agregar bloque'));

  if (!addButton) throw new Error('The add-block button was not rendered');
  await addButton.trigger('click');
}

function latestScheduleChange(wrapper: VueWrapper) {
  const changes = wrapper.emitted('schedule-change') ?? [];
  return changes[changes.length - 1]?.[0] as
    | {
        valid: boolean;
        weekDays: Array<{ name: string; enabled: boolean; start: string; end: string }>;
      }
    | undefined;
}

beforeEach(() => {
  mountedWrappers = [];
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('ref', ref);
});

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe('OnboardingScheduleEditor', () => {
  it('shows closed days and emits the same full per-day shape the onboarding page submits', async () => {
    const wrapper = mountEditor();

    expect(wrapper.text()).toContain('Cerrado: Domingo');
    await addBlock(wrapper);

    const change = latestScheduleChange(wrapper);
    expect(change?.valid).toBe(false);
    expect(change?.weekDays).toEqual([
      { name: 'Lunes', enabled: true, start: '09:00', end: '19:00' },
      { name: 'Martes', enabled: true, start: '09:00', end: '19:00' },
      { name: 'Miércoles', enabled: true, start: '09:00', end: '19:00' },
      { name: 'Jueves', enabled: true, start: '09:00', end: '19:00' },
      { name: 'Viernes', enabled: true, start: '09:00', end: '19:00' },
      { name: 'Sábado', enabled: true, start: '09:00', end: '19:00' },
      { name: 'Domingo', enabled: false, start: '09:00', end: '19:00' },
    ]);
  });

  it('disables days already used by another block and moves an unassigned day to the selected block', async () => {
    const wrapper = mountEditor();
    await addBlock(wrapper);

    const firstBlock = wrapper.get('[aria-label="Bloque de horario 1"]');
    const secondBlock = wrapper.get('[aria-label="Bloque de horario 2"]');
    expect(
      secondBlock
        .get('button[aria-label="Lunes, asignado a otro bloque"]')
        .element.hasAttribute('disabled'),
    ).toBe(true);
    expect(
      secondBlock
        .get('button[aria-label="Domingo, no seleccionado"]')
        .element.hasAttribute('disabled'),
    ).toBe(false);

    await secondBlock.get('button[aria-label="Domingo, no seleccionado"]').trigger('click');

    expect(
      firstBlock
        .get('button[aria-label="Domingo, asignado a otro bloque"]')
        .element.hasAttribute('disabled'),
    ).toBe(true);
    expect(wrapper.text()).toContain('Cerrado: ningún día');
    expect(latestScheduleChange(wrapper)?.weekDays[6]).toEqual({
      name: 'Domingo',
      enabled: true,
      start: '09:00',
      end: '19:00',
    });
  });

  it('reports empty-day and start-before-end validation and emits validity after edits', async () => {
    const wrapper = mountEditor();
    await addBlock(wrapper);

    expect(wrapper.text()).toContain('Selecciona al menos un día para este bloque.');
    const secondBlock = wrapper.get('[aria-label="Bloque de horario 2"]');
    await secondBlock.get('#schedule-start-2').setValue('10:00');
    await secondBlock.get('#schedule-end-2').setValue('09:00');
    expect(wrapper.text()).toContain('La hora de apertura debe ser anterior a la hora de cierre.');
    expect(latestScheduleChange(wrapper)?.valid).toBe(false);

    await secondBlock.get('button[aria-label="Domingo, no seleccionado"]').trigger('click');
    await secondBlock.get('#schedule-start-2').setValue('10:00');
    await secondBlock.get('#schedule-end-2').setValue('11:00');

    expect(wrapper.text()).not.toContain('Selecciona al menos un día para este bloque.');
    expect(wrapper.text()).not.toContain(
      'La hora de apertura debe ser anterior a la hora de cierre.',
    );
    expect(latestScheduleChange(wrapper)?.valid).toBe(true);
  });
});
