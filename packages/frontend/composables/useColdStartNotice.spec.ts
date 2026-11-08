import { ref, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useColdStartNotice, type ColdStartPhase } from './useColdStartNotice';

let phase: Ref<ColdStartPhase>;

beforeEach(() => {
  phase = ref('hidden');
  vi.stubGlobal('useState', () => phase);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useColdStartNotice notifier wiring', () => {
  it('shows waking and recovered clears only the waking phase', () => {
    const { phase, notifier } = useColdStartNotice();

    notifier.waking();
    expect(phase.value).toBe('waking');

    notifier.recovered();
    expect(phase.value).toBe('hidden');

    notifier.failed('read');
    notifier.recovered();
    expect(phase.value).toBe('failed-read');

    notifier.failed('write');
    notifier.recovered();
    expect(phase.value).toBe('failed-write');
  });

  it.each([
    ['read', 'failed-read'],
    ['write', 'failed-write'],
  ] as const)('maps a failed %s request to %s', (kind, expectedPhase) => {
    const { phase, notifier } = useColdStartNotice();

    notifier.failed(kind);

    expect(phase.value).toBe(expectedPhase);
  });

  it.each([
    ['waking', 'read', 'hidden'],
    ['waking', 'write', 'hidden'],
    ['failed-read', 'read', 'hidden'],
    ['failed-read', 'write', 'hidden'],
    ['failed-write', 'read', 'failed-write'],
    ['failed-write', 'write', 'hidden'],
  ] as const)('maps success of %s followed by a %s to %s', (startingPhase, kind, expectedPhase) => {
    phase.value = startingPhase;
    const { notifier } = useColdStartNotice();

    notifier.succeeded(kind);

    expect(phase.value).toBe(expectedPhase);
  });
});
