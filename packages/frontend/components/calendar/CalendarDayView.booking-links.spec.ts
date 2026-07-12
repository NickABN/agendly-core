import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'CalendarDayView.vue'), 'utf-8');

describe('CalendarDayView public booking link surfaces', () => {
  it('renders the runtime-config-driven booking display URL in the empty state and link card', () => {
    expect(source).toContain('const publicUrlLabel = computed(() => bookingDisplayUrl(props.slug));');
    expect((source.match(/\{\{ publicUrlLabel \}\}/g) || []).length).toBe(2);
  });

  it('wires copy behavior through the centralized booking URL helper', () => {
    expect(source).toContain('@click="copyPublicUrl"');
    expect(source).toContain('const publicUrl = computed(() => bookingUrl(props.slug));');
    expect(source).toContain('navigator.clipboard.writeText(publicUrl.value);');
  });
});
