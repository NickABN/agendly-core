import { describe, expect, it } from 'vitest';
import {
  areScheduleBlocksValid,
  expandScheduleBlocks,
  validateScheduleBlock,
  type OnboardingScheduleBlock,
} from './onboardingSchedule';

describe('onboarding schedule helpers', () => {
  it('requires each block to contain a day and an opening time before its closing time', () => {
    const validBoundaryBlock: OnboardingScheduleBlock = {
      id: 1,
      days: [0],
      start: '00:00',
      end: '23:59',
    };
    expect(validateScheduleBlock(validBoundaryBlock)).toEqual({
      hasDays: true,
      validTime: true,
      isValid: true,
    });

    expect(
      validateScheduleBlock({ ...validBoundaryBlock, start: '09:00', end: '09:00' }).validTime,
    ).toBe(false);
    expect(
      validateScheduleBlock({ ...validBoundaryBlock, start: '10:00', end: '09:00' }).isValid,
    ).toBe(false);
    expect(
      validateScheduleBlock({ ...validBoundaryBlock, start: '24:00', end: '23:59' }).validTime,
    ).toBe(false);

    expect(validateScheduleBlock({ ...validBoundaryBlock, days: [] })).toEqual({
      hasDays: false,
      validTime: true,
      isValid: false,
    });
    expect(
      areScheduleBlocksValid([
        validBoundaryBlock,
        { id: 2, days: [], start: '09:00', end: '10:00' },
      ]),
    ).toBe(false);
  });

  it('expands blocks into the previous seven-day schedule shape and leaves unassigned days closed', () => {
    const expandedSchedule = expandScheduleBlocks([
      { id: 1, days: [0, 2], start: '08:30', end: '12:00' },
      { id: 2, days: [1, 4], start: '13:00', end: '17:30' },
    ]);

    expect(expandedSchedule).toEqual([
      { name: 'Lunes', enabled: true, start: '08:30', end: '12:00' },
      { name: 'Martes', enabled: true, start: '13:00', end: '17:30' },
      { name: 'Miércoles', enabled: true, start: '08:30', end: '12:00' },
      { name: 'Jueves', enabled: false, start: '09:00', end: '19:00' },
      { name: 'Viernes', enabled: true, start: '13:00', end: '17:30' },
      { name: 'Sábado', enabled: false, start: '09:00', end: '19:00' },
      { name: 'Domingo', enabled: false, start: '09:00', end: '19:00' },
    ]);
  });
});
