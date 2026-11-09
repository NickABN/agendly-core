// @vitest-environment jsdom
import { ref, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppToast } from './useAppToast';

type Toast = { id: string; kind: string; message: string };

let sharedToasts: Ref<Toast[]>;
const mockUseState = vi.fn((_key: string, _init: () => Toast[]) => sharedToasts);

beforeEach(() => {
  sharedToasts = ref([]);
  mockUseState.mockClear();
  vi.stubGlobal('useState', mockUseState);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAppToast', () => {
  it('adds success and error messages to the shared reactive list', () => {
    const first = useAppToast();
    const second = useAppToast();

    first.success('Cambios guardados.');
    second.error('No se pudieron guardar los cambios.');

    expect(first.toasts).toBe(second.toasts);
    expect(mockUseState).toHaveBeenCalledWith('app-toasts', expect.any(Function));
    expect(sharedToasts.value).toEqual([
      expect.objectContaining({ kind: 'success', message: 'Cambios guardados.' }),
      expect.objectContaining({ kind: 'error', message: 'No se pudieron guardar los cambios.' }),
    ]);
  });

  it('auto-dismisses success after 4 seconds and error after 6 seconds', () => {
    vi.useFakeTimers();
    const toast = useAppToast();

    toast.success('Guardado.');
    toast.error('Falló.');

    vi.advanceTimersByTime(3999);
    expect(sharedToasts.value).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sharedToasts.value.map(({ message }) => message)).toEqual(['Falló.']);
    vi.advanceTimersByTime(1999);
    expect(sharedToasts.value).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sharedToasts.value).toHaveLength(0);
  });

  it('removes a toast when explicitly closed', () => {
    const toast = useAppToast();
    toast.success('Temporal.');

    toast.remove(sharedToasts.value[0]!.id);

    expect(sharedToasts.value).toHaveLength(0);
  });

  it('keeps only the three newest visible toasts', () => {
    const toast = useAppToast();
    toast.success('Primero.');
    toast.success('Segundo.');
    toast.error('Tercero.');
    toast.success('Cuarto.');

    expect(sharedToasts.value.map(({ message }) => message)).toEqual([
      'Segundo.',
      'Tercero.',
      'Cuarto.',
    ]);
  });
});
