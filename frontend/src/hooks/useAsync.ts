import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Data fetch karne ka chhota hook - loading, error aur reload ek jagah.
 * `deps` badalne par dobara fetch hota hai; unmount par result ignore ho jaata hai.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { reload: () => void; setData: (d: T | null) => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, isLoading: true, error: null });
  const [nonce, setNonce] = useState(0);

  // fetcher har render me naya function hota hai - ref me rakho taaki deps clean rahein
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetcherRef
      .current()
      .then((data) => {
        if (active) setState({ data, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const message =
          err instanceof ApiError
            ? err.detail
            : err instanceof Error
              ? err.message
              : 'Could not load the data.';

        setState({ data: null, isLoading: false, error: message });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((d: T | null) => setState((prev) => ({ ...prev, data: d })), []);

  return { ...state, reload, setData };
}

/**
 * Form submit / action ke liye - busy flag aur error handling.
 */
export function useAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setIsBusy(true);
      setError(null);
      try {
        return await action(...args);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.detail
            : err instanceof Error
              ? err.message
              : 'The action failed.';
        setError(message);
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [action],
  );

  return { run, isBusy, error, clearError: () => setError(null) };
}

/** Search box ke liye debounce. */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

/** Page title set karne ke liye. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} | FoodMitra`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
