import type { ApiResponse } from '@/types';

/* ============================================================
   Ek hi fetch wrapper:
   - JWT access token automatically lagata hai
   - 401 aane par refresh token se ek baar retry karta hai
   - API ka { success, message, data } envelope unwrap karta hai
   - error hone par ApiError throw karta hai (message backend ka)
   ============================================================ */

const TOKEN_KEY = 'fm_access_token';
const REFRESH_KEY = 'fm_refresh_token';
const USER_KEY = 'fm_user';

export class ApiError extends Error {
  readonly status: number;
  readonly errors: string[];

  constructor(message: string, status: number, errors: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  /** Validation errors ko ek readable line me jodta hai. */
  get detail(): string {
    return this.errors.length > 0 ? this.errors.join(' ') : this.message;
  }
}

/* --------------------------- token store --------------------------- */

export const tokenStore = {
  get access(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  get refresh(): string | null {
    try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
  },
  get rawUser(): string | null {
    try { return localStorage.getItem(USER_KEY); } catch { return null; }
  },
  save(access: string, refresh: string, user: unknown) {
    try {
      localStorage.setItem(TOKEN_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch { /* private mode - chalne do */ }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    } catch { /* ignore */ }
  },
};

/* ----------------------- unauthorized handler ---------------------- */

type Listener = () => void;
const logoutListeners = new Set<Listener>();

/** AuthContext isse subscribe karta hai, taaki refresh fail hone par logout ho jaye. */
export function onForcedLogout(fn: Listener): () => void {
  logoutListeners.add(fn);
  return () => logoutListeners.delete(fn);
}

function forceLogout() {
  tokenStore.clear();
  logoutListeners.forEach((fn) => fn());
}

/* --------------------------- refresh flow -------------------------- */

// Ek hi waqt me kai 401 aa sakte hain - sabko ek hi refresh call par wait karao
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.refresh;
  if (!refresh) return null;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });

      if (!res.ok) return null;

      const json = (await res.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
      }>;

      if (!json.success || !json.data?.accessToken) return null;

      tokenStore.save(json.data.accessToken, json.data.refreshToken, json.data);
      return json.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/* ----------------------------- core call --------------------------- */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  /** FormData bhejni ho to yahan do - Content-Type browser lagayega */
  formData?: FormData;
  signal?: AbortSignal;
  /** true = token na ho to bhi call karo (public endpoints) */
  anonymous?: boolean;
}

async function call<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, formData, signal, anonymous = false } = options;

  const headers: Record<string, string> = {};
  if (!formData && body !== undefined) headers['Content-Type'] = 'application/json';

  const token = tokenStore.access;
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(
      'Cannot reach the server. Check your internet connection or whether the API is running.',
      0,
    );
  }

  /* ---- 401: ek baar refresh karke retry ---- */
  if (res.status === 401 && !isRetry && !anonymous && tokenStore.refresh) {
    const fresh = await refreshAccessToken();
    if (fresh) return call<T>(path, options, true);

    forceLogout();
    throw new ApiError('Your session expired. Please log in again.', 401);
  }

  if (res.status === 401 && !anonymous) {
    forceLogout();
    throw new ApiError('Please log in.', 401);
  }

  /* ---- 204 / empty body ---- */
  if (res.status === 204) return undefined as T;

  let json: ApiResponse<T> | null = null;
  const text = await res.text();

  if (text) {
    try {
      json = JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new ApiError(
        res.ok ? 'Server ne unexpected response bheja.' : text.slice(0, 200),
        res.status,
      );
    }
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(
      json?.message ?? `Request fail hui (HTTP ${res.status}).`,
      res.status,
      json?.errors ?? [],
    );
  }

  return json?.data as T;
}

/* --------------------------- query helper -------------------------- */

/** Object ko query string me badalta hai; null/undefined/'' skip ho jaate hain. */
export function qs(params: Record<string, unknown> | undefined): string {
  if (!params) return '';

  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') {
      if (value) sp.set(key, 'true');   // false bhejne ka fayda nahi, SP ka default 0 hai
      continue;
    }
    sp.set(key, String(value));
  }

  const s = sp.toString();
  return s ? `?${s}` : '';
}

/* ------------------------------- api ------------------------------- */

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    call<T>(path, { ...opts, method: 'GET' }),

  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    call<T>(path, { ...opts, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    call<T>(path, { ...opts, method: 'PUT', body }),

  del: <T>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
    call<T>(path, { ...opts, method: 'DELETE' }),

  upload: <T>(path: string, file: File, opts?: Omit<RequestOptions, 'method' | 'formData'>) => {
    const fd = new FormData();
    fd.append('file', file);
    return call<T>(path, { ...opts, method: 'POST', formData: fd });
  },
};
