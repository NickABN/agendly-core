import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'onboarding.vue'), 'utf-8');

describe('onboarding.vue step-4 schedule wiring', () => {
  it('keeps the created employee ids so step 4 can assign their schedules', () => {
    expect(source).toContain('createdEmployeeIds.value = created.map');
  });

  it('submits the edited weekly hours before completing onboarding', () => {
    expect(source).toContain('await onboarding.saveSchedules(createdEmployeeIds.value, weekDays);');
  });

  it('no longer creates backend default schedules that ignore user input', () => {
    expect(source).not.toContain('createDefaultSchedule');
  });
});
