import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { SafeImage, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/useAsync';

/** Demo accounts - seed data me yahi users hain. */
const DEMO = [
  { role: 'Admin', email: 'admin@foodmitra.in', note: 'Poora system control' },
  { role: 'Employee', email: 'rahul.emp@foodmitra.in', note: '2 restaurants assigned' },
  { role: 'Customer', email: 'ananya@example.com', note: 'Order aur booking' },
];

export default function Login() {
  usePageTitle('Login');

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const routeLocation = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (routeLocation.state as { from?: string } | null)?.from;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}!`);

      // role ke hisaab se landing page
      if (from) navigate(from, { replace: true });
      else if (user.role === 'Admin') navigate('/admin', { replace: true });
      else if (user.role === 'Employee') navigate('/employee', { replace: true });
      else navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Pass@123');
    setError(null);
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* ==================== left: visual ==================== */}
      <div className="relative hidden lg:block">
        <SafeImage
          src="https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80&auto=format&fit=crop"
          alt=""
          loading="eager"
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900/85 to-brand-900/70" />

        <div className="absolute inset-0 flex flex-col justify-center px-12">
          <p className="text-3xl font-extrabold tracking-tight text-white">
            food<span className="text-brand-400">mitra</span>
          </p>

          <h2 className="mt-4 max-w-md text-3xl leading-tight font-bold text-white">
            Food, tables and party halls - all in one place
          </h2>

          <ul className="mt-6 space-y-3">
            {[
              '15 km tak delivery, live order tracking',
              'Book a table in advance - no more waiting',
              'Birthday party ka hall, decoration ke saath',
              'Save on every order with coupons',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/20">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ==================== right: form ==================== */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-ink-900">Log in</h1>
          <p className="mt-1 text-sm text-ink-500">
            Account nahi hai?{' '}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              Sign up
            </Link>
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="li-email" className="label">
                Email
              </label>
              <input
                id="li-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="li-pass" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="li-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="********"
                  className="input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 cursor-pointer px-3 text-ink-400 transition hover:text-ink-700"
                  aria-label={showPassword ? 'Password chhupao' : 'Password dikhao'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
                    {showPassword ? (
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9.5 9.5 0 0 1 12 5c5 0 9 4.5 9 7 0 .9-.5 2-1.4 3.1M6.2 6.7C3.9 8.2 3 10.3 3 12c0 2.5 4 7 9 7 1.3 0 2.5-.3 3.6-.8" strokeLinecap="round" />
                    ) : (
                      <>
                        <path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7Z" strokeLinecap="round" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-800">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy && <Spinner className="size-4" />}
              Login
            </button>
          </form>

          {/* ---- demo accounts ---- */}
          <div className="mt-8 rounded-xl border border-ink-200 bg-ink-50 p-4">
            <p className="text-sm font-semibold text-ink-800">Demo accounts</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Password for all: <span className="font-mono font-bold">Pass@123</span>
            </p>

            <div className="mt-3 space-y-1.5">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => fillDemo(d.email)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left ring-1 ring-ink-200 transition hover:ring-brand-400"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-bold tracking-wide text-brand-700 uppercase">
                      {d.role}
                    </span>
                    <span className="block truncate text-xs text-ink-600">{d.email}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-400">{d.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
