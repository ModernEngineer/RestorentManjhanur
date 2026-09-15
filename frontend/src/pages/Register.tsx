import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/useAsync';

export default function Register() {
  usePageTitle('Sign up');

  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* password strength - backend ke rules jaise hi */
  const strength = useMemo(() => {
    const checks = [
      { ok: password.length >= 8, label: 'At least 8 characters' },
      { ok: /[a-zA-Z]/.test(password), label: 'Ek letter (a-z)' },
      { ok: /\d/.test(password), label: 'Ek number (0-9)' },
      { ok: /[^a-zA-Z0-9]/.test(password), label: 'Ek special character (recommended)' },
    ];

    const required = checks.slice(0, 3).filter((c) => c.ok).length;
    return { checks, valid: required === 3, score: checks.filter((c) => c.ok).length };
  }, [password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!strength.valid) {
      setError('Meet the password rules (8+ characters, one letter and one number).');
      return;
    }

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const user = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });

      toast.success(`Account created. Welcome, ${user.fullName.split(' ')[0]}!`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  };

  const barColor =
    strength.score <= 1 ? 'bg-brand-500' : strength.score === 2 ? 'bg-amber-500' : strength.score === 3 ? 'bg-rating-500' : 'bg-rating-600';

  return (
    <div className="container-app flex items-center justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink-900">Account banao</h1>
        <p className="mt-1 text-sm text-ink-500">
          Pehle se account hai?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="rg-name" className="label">
              Poora naam
            </label>
            <input
              id="rg-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              placeholder="e.g. Ananya Sharma"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="rg-email" className="label">
              Email
            </label>
            <input
              id="rg-email"
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
            <label htmlFor="rg-phone" className="label">
              Phone number (optional)
            </label>
            <input
              id="rg-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
              maxLength={20}
              autoComplete="tel"
              placeholder="9810000000"
              className="input"
            />
            <p className="mt-1 text-xs text-ink-400">
              Delivery partner isi number par call karega.
            </p>
          </div>

          <div>
            <label htmlFor="rg-pass" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="rg-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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

            {/* strength meter */}
            {password.length > 0 && (
              <>
                <div className="mt-2 flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i < strength.score ? barColor : 'bg-ink-200'}`}
                    />
                  ))}
                </div>

                <ul className="mt-2 space-y-0.5">
                  {strength.checks.map((c) => (
                    <li
                      key={c.label}
                      className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-rating-500' : 'text-ink-400'}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3 shrink-0">
                        {c.ok ? (
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                          <circle cx="12" cy="12" r="9" strokeWidth="2" />
                        )}
                      </svg>
                      {c.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            <label htmlFor="rg-confirm" className="label">
              Password dobara likho
            </label>
            <input
              id="rg-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="input"
            />
            {confirm.length > 0 && confirm !== password && (
              <p className="field-error">Passwords do not match.</p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-800">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full py-3">
            {busy && <Spinner className="size-4" />}
            Account banao
          </button>

          <p className="text-center text-xs text-ink-400">
            By signing up you accept the terms and privacy policy. (Demo project - no real data
            is collected.)
          </p>
        </form>
      </div>
    </div>
  );
}
