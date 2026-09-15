import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/* ============================================================
   Chhote reusable UI primitives - poore app me yahi use hote hain.
   ============================================================ */

/* ------------------------------ Spinner ---------------------------- */

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" className="opacity-20" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-ink-500">
      <Spinner className="size-8 text-brand-600" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

/* ----------------------------- Skeletons --------------------------- */

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-44 w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-4 w-3/5" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-3 w-2/5" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-14 w-full" />
      ))}
    </div>
  );
}

/* ---------------------------- EmptyState --------------------------- */

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-ink-100 text-ink-400">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-7">
            <path d="M3 3h18v4H3zM5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 12h6" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {description && <p className="max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* --------------------------- Error banner -------------------------- */

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 shrink-0 text-brand-700">
        <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" />
      </svg>
      <p className="flex-1 text-sm font-medium text-brand-800">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-outline btn-sm">
          Try again
        </button>
      )}
    </div>
  );
}

/* --------------------------- Rating badge -------------------------- */

export function RatingBadge({
  value,
  reviews,
  size = 'md',
}: {
  value: number | null | undefined;
  reviews?: number;
  size?: 'sm' | 'md';
}) {
  const rating = Number(value ?? 0);
  const shown = rating > 0 ? rating.toFixed(1) : '--';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rating-badge ${size === 'sm' ? 'px-1 py-0 text-[10px]' : ''} ${
          rating > 0 && rating < 3.5 ? 'bg-amber-600' : ''
        }`}
      >
        {shown}
        <svg viewBox="0 0 24 24" fill="currentColor" className={size === 'sm' ? 'size-2.5' : 'size-3'}>
          <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
        </svg>
      </span>
      {reviews !== undefined && reviews > 0 && (
        <span className="text-xs text-ink-500">({reviews.toLocaleString('en-IN')})</span>
      )}
    </span>
  );
}

/* ---------------------------- Veg marker --------------------------- */

export function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={isVeg ? 'veg-mark' : 'nonveg-mark'}
      title={isVeg ? 'Veg' : 'Non-veg'}
      aria-label={isVeg ? 'Veg' : 'Non-veg'}
    />
  );
}

/* ------------------------------ Badge ------------------------------ */

const BADGE_TONES = {
  green: 'bg-green-50 text-green-700 ring-1 ring-green-600/20',
  red: 'bg-brand-50 text-brand-700 ring-1 ring-brand-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  gray: 'bg-ink-100 text-ink-600 ring-1 ring-ink-300/40',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = 'gray',
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return <span className={`badge ${BADGE_TONES[tone]} ${className}`}>{children}</span>;
}

/** Order / booking / payment status ko rang ke saath dikhata hai. */
export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === 'DELIVERED' || status === 'PAID' || status === 'COMPLETED' || status === 'LIVE'
      ? 'green'
      : status === 'CANCELLED' || status === 'REJECTED' || status === 'FAILED' || status === 'EXPIRED'
        ? 'red'
        : status === 'OUT_FOR_DELIVERY' || status === 'PREPARING' || status === 'SEATED'
          ? 'blue'
          : status === 'PENDING' || status === 'PLACED' || status === 'CREATED' || status === 'SCHEDULED'
            ? 'amber'
            : status === 'CONFIRMED'
              ? 'purple'
              : status === 'REFUNDED'
                ? 'gray'
                : 'gray';

  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}

/* ---------------------------- Pagination --------------------------- */

export function Pagination({
  pageNumber,
  totalPages,
  totalCount,
  onChange,
}: {
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  const push = (p: number | '...') => pages.push(p);

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
  } else {
    push(1);
    if (pageNumber > 3) push('...');
    for (let i = Math.max(2, pageNumber - 1); i <= Math.min(totalPages - 1, pageNumber + 1); i++) push(i);
    if (pageNumber < totalPages - 2) push('...');
    push(totalPages);
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-ink-500">
        Page <span className="font-semibold text-ink-700">{pageNumber}</span> / {totalPages}
        <span className="mx-2 text-ink-300">|</span>
        {totalCount.toLocaleString('en-IN')} results
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(pageNumber - 1)}
          disabled={pageNumber <= 1}
          className="btn-outline btn-sm"
        >
          Pichla
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`gap-${i}`} className="px-1.5 text-ink-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === pageNumber ? 'page' : undefined}
              className={`size-8 cursor-pointer rounded-lg text-sm font-semibold transition ${
                p === pageNumber
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onChange(pageNumber + 1)}
          disabled={pageNumber >= totalPages}
          className="btn-outline btn-sm"
        >
          Agla
        </button>
      </div>
    </nav>
  );
}

/* ------------------------------ Modal ------------------------------ */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-900/55 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 max-h-[92vh] w-full ${widths[size]} animate-fade-up overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* -------------------------- ConfirmDialog -------------------------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes, do it',
  cancelLabel = 'No',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onCancel} className="btn-outline" disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={danger ? 'btn-danger' : 'btn-primary'}
            disabled={busy}
          >
            {busy && <Spinner className="size-4" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-600">{message}</p>
    </Modal>
  );
}

/* ---------------------------- Stat tile ---------------------------- */

export function StatTile({
  label,
  value,
  sub,
  tone = 'gray',
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  const accents: Record<BadgeTone, string> = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-ink-100 text-ink-600',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${accents[tone]}`}>{icon}</span>}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
        <p className="mt-0.5 text-2xl leading-tight font-bold text-ink-900">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

/* --------------------------- Star picker --------------------------- */

export function StarPicker({
  value,
  onChange,
  size = 'md',
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
}) {
  const dims = { sm: 'size-4', md: 'size-6', lg: 'size-8' };

  return (
    <div className="flex items-center gap-1" role={readOnly ? 'img' : 'radiogroup'} aria-label={`Rating ${value} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer transition hover:scale-110'}`}
          aria-label={`${star} star`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`${dims[size]} ${star <= Math.round(value) ? 'text-amber-400' : 'text-ink-200'}`}
            fill="currentColor"
          >
            <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ------------------------- Section heading ------------------------- */

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* --------------------------- Image with fallback -------------------- */

const FALLBACK_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
       <rect width="400" height="300" fill="#eceef0"/>
       <g fill="#b8bfc8">
         <circle cx="200" cy="128" r="34"/>
         <path d="M150 190h100a10 10 0 0 1 10 10v6H140v-6a10 10 0 0 1 10-10z"/>
       </g>
       <text x="200" y="240" font-family="sans-serif" font-size="15" fill="#8a939f" text-anchor="middle">No image</text>
     </svg>`,
  );

export function SafeImage({
  src,
  alt,
  className = '',
  loading = 'lazy',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  return (
    <img
      src={src || FALLBACK_IMG}
      alt={alt}
      loading={loading}
      className={className}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
      }}
    />
  );
}

export { FALLBACK_IMG };
