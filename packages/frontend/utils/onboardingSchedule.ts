export interface OnboardingScheduleBlock {
  id: number;
  days: number[];
  start: string;
  end: string;
}

export interface OnboardingWeekDaySchedule {
  name: string;
  enabled: boolean;
  start: string;
  end: string;
}

export interface ScheduleBlockValidation {
  hasDays: boolean;
  validTime: boolean;
  isValid: boolean;
}

export interface ScheduleChange {
  weekDays: OnboardingWeekDaySchedule[];
  valid: boolean;
}

export const ONBOARDING_WEEK_DAYS = [
  { name: 'Lunes', shortName: 'L' },
  { name: 'Martes', shortName: 'M' },
  { name: 'Miércoles', shortName: 'M' },
  { name: 'Jueves', shortName: 'J' },
  { name: 'Viernes', shortName: 'V' },
  { name: 'Sábado', shortName: 'S' },
  { name: 'Domingo', shortName: 'D' },
] as const;

export function createInitialScheduleBlocks(): OnboardingScheduleBlock[] {
  return [{ id: 1, days: [0, 1, 2, 3, 4, 5], start: '09:00', end: '19:00' }];
}

export function validateScheduleBlock(block: OnboardingScheduleBlock): ScheduleBlockValidation {
  const hasDays = block.days.length > 0;
  const startMinutes = parseTime(block.start);
  const endMinutes = parseTime(block.end);
  const validTime = startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;

  return { hasDays, validTime, isValid: hasDays && validTime };
}

export function areScheduleBlocksValid(blocks: OnboardingScheduleBlock[]): boolean {
  return blocks.every((block) => validateScheduleBlock(block).isValid);
}

export function expandScheduleBlocks(
  blocks: OnboardingScheduleBlock[],
): OnboardingWeekDaySchedule[] {
  return ONBOARDING_WEEK_DAYS.map((day, dayIndex) => {
    const block = blocks.find((candidate) => candidate.days.includes(dayIndex));

    return {
      name: day.name,
      enabled: Boolean(block),
      start: block?.start ?? '09:00',
      end: block?.end ?? '19:00',
    };
  });
}

function parseTime(value: string): number | null {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return null;

  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
