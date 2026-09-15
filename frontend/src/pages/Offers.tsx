import { useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '@/api/endpoints';
import { Badge, EmptyState, ErrorBanner, RowsSkeleton } from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

const SCOPES = [
  { key: '', label: 'All offers' },
  { key: 'ORDER', label: 'Food orders' },
  { key: 'TABLE', label: 'Table booking' },
  { key: 'HALL', label: 'Party halls' },
];

export default function Offers() {
  usePageTitle('Offers aur coupons');

  const { currency } = useLocationCtx();
  const toast = useToast();
  const [scope, setScope] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, error, reload } = useAsync(
    () => orderApi.coupons({ appliesTo: scope || undefined }),
    [scope],
  );

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.success(`${code} copied!`);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      toast.info(`Code: ${code} - please copy it manually.`);
    }
  };

  const daysLeft = (validTo: string) => {
    const diff = new Date(validTo).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  return (
    <div className="container-app py-6">
      <h1 className="mb-1 text-2xl font-bold text-ink-900 sm:text-3xl">Offers aur coupons</h1>
      <p className="mb-5 text-sm text-ink-500">
        Copy a code and apply it at checkout. All live coupons are listed here.
      </p>

      {/* ---- scope tabs ---- */}
      <div className="mb-6 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setScope(s.key)}
            className={`chip ${scope === s.key ? 'chip-active' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : isLoading ? (
        <RowsSkeleton rows={4} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No offers right now"
          description="Check back later - new coupons keep coming."
          action={
            <Link to="/restaurants" className="btn-primary">
              Browse restaurants
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((c) => {
            const left = daysLeft(c.validTo);

            return (
              <article
                key={c.couponId}
                className="relative overflow-hidden rounded-[var(--radius-card)] border border-ink-100 bg-white shadow-card"
              >
                {/* ticket notches */}
                <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-ink-50" />
                <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-ink-50" />

                <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-5 text-white">
                  <p className="text-3xl leading-none font-extrabold">
                    {c.discountType === 'PERCENT'
                      ? `${c.discountValue}%`
                      : currency(c.discountValue)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white/90">
                    OFF
                    {c.maxDiscountAmount ? ` up to ${currency(c.maxDiscountAmount)}` : ''}
                  </p>
                </div>

                <div className="border-t border-dashed border-ink-200 px-5 py-4">
                  <h2 className="text-sm font-semibold text-ink-900">{c.title}</h2>

                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">{c.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone={c.appliesTo === 'HALL' ? 'purple' : c.appliesTo === 'TABLE' ? 'blue' : 'green'}>
                      {c.appliesTo === 'ORDER' ? 'Food order' : c.appliesTo === 'TABLE' ? 'Table booking' : 'Party hall'}
                    </Badge>

                    {c.minOrderAmount > 0 && <Badge>Min {currency(c.minOrderAmount)}</Badge>}

                    {left <= 7 && <Badge tone="amber">{left} din bache</Badge>}
                  </div>

                  {c.restaurantName && (
                    <p className="mt-2 truncate text-xs text-ink-400">
                      Sirf {c.restaurantName} par valid
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => copy(c.code)}
                    className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-brand-400 bg-brand-50 px-3.5 py-2.5 transition hover:bg-brand-100"
                  >
                    <span className="font-mono text-sm font-bold tracking-wider text-brand-700">
                      {c.code}
                    </span>
                    <span className="text-xs font-semibold text-brand-700">
                      {copied === c.code ? 'Copied!' : 'Copy'}
                    </span>
                  </button>

                  <p className="mt-2 text-[11px] text-ink-400">
                    Valid till{' '}
                    {new Date(c.validTo).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
