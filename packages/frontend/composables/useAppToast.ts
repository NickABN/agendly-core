export type ToastKind = 'success' | 'error';

export interface AppToast {
  id: string;
  kind: ToastKind;
  message: string;
}

export function useAppToast() {
  const toasts = useState<AppToast[]>('app-toasts', () => []);

  function remove(id: string) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function add(kind: ToastKind, message: string) {
    const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const toast: AppToast = { id, kind, message };
    toasts.value = [...toasts.value, toast].slice(-3);

    const duration = kind === 'success' ? 4000 : 6000;
    setTimeout(() => remove(id), duration);
  }

  return {
    toasts,
    success: (message: string) => add('success', message),
    error: (message: string) => add('error', message),
    remove,
  };
}
