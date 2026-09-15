import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast(message: string, kind?: ToastKind): void;
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
  /** Kisi bhi unknown error ko readable message me badal kar dikhata hai */
  fromError(err: unknown, fallback?: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

const STYLES: Record<ToastKind, string> = {
  success: 'border-rating-500/30 bg-white text-ink-800',
  error: 'border-brand-600/30 bg-white text-ink-800',
  info: 'border-ink-200 bg-white text-ink-800',
};

const ICON_COLORS: Record<ToastKind, string> = {
  success: 'bg-rating-500 text-white',
  error: 'bg-brand-600 text-white',
  info: 'bg-ink-700 text-white',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      if (!message) return;

      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);

      const timer = window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3800);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m: string) => toast(m, 'success'),
      error: (m: string) => toast(m, 'error'),
      info: (m: string) => toast(m, 'info'),
      fromError: (err: unknown, fallback = 'Something went wrong. Please try again.') => {
        const message =
          err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
            ? err.detail
            : err instanceof Error
              ? err.message
              : fallback;
        toast(message || fallback, 'error');
      },
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:top-20 sm:right-4 sm:left-auto sm:items-end"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl border px-4 py-3 shadow-pop ${STYLES[t.kind]}`}
          >
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${ICON_COLORS[t.kind]}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3">
                <path d={ICONS[t.kind]} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>

            <p className="flex-1 text-sm leading-snug font-medium">{t.message}</p>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-mr-1 rounded p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider.');
  return ctx;
}
