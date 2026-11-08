import { noticePhaseAfterSuccess } from '~/utils/coldStart';
import type { ColdStartNoticePhase, ColdStartNotifier } from '~/utils/coldStart';

export type ColdStartPhase = ColdStartNoticePhase;

/**
 * App-wide state of the "server is waking up" notice (see utils/coldStart.ts).
 * Driven by the `$fetch` wrapper in plugins/cold-start.client.ts and rendered by
 * <ColdStartNotice /> in app.vue.
 */
export function useColdStartNotice() {
  const phase = useState<ColdStartPhase>('cold-start-phase', () => 'hidden');

  const notifier: ColdStartNotifier = {
    waking() {
      phase.value = 'waking';
    },
    recovered() {
      // Another request may have already failed; only clear the "waking" state.
      if (phase.value === 'waking') phase.value = 'hidden';
    },
    failed(kind) {
      phase.value = kind === 'read' ? 'failed-read' : 'failed-write';
    },
    succeeded(kind) {
      phase.value = noticePhaseAfterSuccess(phase.value, kind);
    },
  };

  function dismiss() {
    phase.value = 'hidden';
  }

  return { phase, notifier, dismiss };
}
