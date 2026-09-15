import { useState } from 'react';
import { adminApi } from '@/api/endpoints';
import {
  Badge, EmptyState, ErrorBanner, Modal, Pagination, RowsSkeleton, Spinner, StatusBadge,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, useDebounced, usePageTitle } from '@/hooks/useAsync';
import type { Coupon } from '@/types';

export default function AdminCoupons() {
  usePageTitle('Coupons & discounts');

  const { currency } = useLocationCtx();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const coupons = useAsync(
    () => adminApi.coupons({ search: debouncedSearch || undefined, pageNumber: page, pageSize: 20 }),
    [debouncedSearch, page],
  );

  const restaurants = useAsync(() => adminApi.restaurants({ pageSize: 100 }), []);

  const toggle = async (c: Coupon) => {
    setBusyId(c.couponId);
    try {
      await adminApi.toggleCoupon(c.couponId, !c.isActive);
      toast.success(c.isActive ? `${c.code} has been turned off.` : `${c.code} is now live.`);
      coupons.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Coupons &amp; discounts</h1>
          <p className="text-sm text-ink-500">
            Create coupons for food orders, table bookings and party halls.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditCoupon(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + New coupon
        </button>
      </div>

      <div className="card p-4">
        <label htmlFor="ac-search" className="label">Search</label>
        <input
          id="ac-search"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Code ya title"
          className="input max-w-sm"
        />
      </div>

      {coupons.error ? (
        <ErrorBanner message={coupons.error} onRetry={coupons.reload} />
      ) : coupons.isLoading ? (
        <RowsSkeleton rows={5} />
      ) : (coupons.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No coupons yet" description="Create your first coupon and give customers a discount." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Conditions</th>
                    <th>Scope</th>
                    <th>Usage</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {coupons.data!.items.map((c) => (
                    <tr key={c.couponId}>
                      <td>
                        <p className="font-mono text-sm font-bold text-brand-700">{c.code}</p>
                        <p className="max-w-48 truncate text-xs text-ink-500">{c.title}</p>
                      </td>

                      <td className="text-sm font-semibold">
                        {c.discountType === 'PERCENT' ? `${c.discountValue}%` : currency(c.discountValue)}
                        {c.maxDiscountAmount ? (
                          <span className="block text-xs font-normal text-ink-400">
                            max {currency(c.maxDiscountAmount)}
                          </span>
                        ) : null}
                      </td>

                      <td className="text-xs">
                        {c.minOrderAmount > 0 ? `Min ${currency(c.minOrderAmount)}` : 'No minimum'}
                      </td>

                      <td className="text-xs">
                        <Badge tone={c.appliesTo === 'HALL' ? 'purple' : c.appliesTo === 'TABLE' ? 'blue' : 'green'}>
                          {c.appliesTo}
                        </Badge>
                        {c.restaurantName && (
                          <p className="mt-1 max-w-40 truncate text-ink-400">{c.restaurantName}</p>
                        )}
                      </td>

                      <td className="text-xs">
                        {c.usedCount ?? 0}
                        {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                        {c.usageLimitPerUser ? (
                          <span className="block text-ink-400">{c.usageLimitPerUser} per user</span>
                        ) : null}
                      </td>

                      <td className="text-xs text-ink-500">
                        {new Date(c.validFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' - '}
                        {new Date(c.validTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>

                      <td>
                        <StatusBadge status={c.computedStatus ?? (c.isActive ? 'LIVE' : 'INACTIVE')} />
                      </td>

                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditCoupon(c);
                              setShowForm(true);
                            }}
                            className="btn-outline btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggle(c)}
                            disabled={busyId === c.couponId}
                            className={`btn-sm ${c.isActive ? 'btn-ghost !text-brand-700' : 'btn-success'}`}
                          >
                            {busyId === c.couponId && <Spinner className="size-3.5" />}
                            {c.isActive ? 'Close' : 'Go live'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            pageNumber={coupons.data!.pageNumber}
            totalPages={coupons.data!.totalPages}
            totalCount={coupons.data!.totalCount}
            onChange={setPage}
          />
        </>
      )}

      {showForm && (
        <CouponForm
          open={showForm}
          existing={editCoupon}
          restaurants={(restaurants.data?.items ?? []).map((r) => ({
            restaurantId: r.restaurantId,
            name: r.name,
            locality: r.locality,
          }))}
          onClose={() => {
            setShowForm(false);
            setEditCoupon(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditCoupon(null);
            coupons.reload();
          }}
        />
      )}
    </div>
  );
}

/* ================================================================= */

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function CouponForm({
  open,
  onClose,
  existing,
  restaurants,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing: Coupon | null;
  restaurants: { restaurantId: number; name: string; locality: string }[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const { currency } = useLocationCtx();

  const [code, setCode] = useState(existing?.code ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FLAT'>(existing?.discountType ?? 'PERCENT');
  const [discountValue, setDiscountValue] = useState(existing?.discountValue?.toString() ?? '10');
  const [maxDiscount, setMaxDiscount] = useState(existing?.maxDiscountAmount?.toString() ?? '');
  const [minOrder, setMinOrder] = useState(existing?.minOrderAmount?.toString() ?? '0');
  const [restaurantId, setRestaurantId] = useState(existing?.restaurantId?.toString() ?? '');
  const [appliesTo, setAppliesTo] = useState<'ORDER' | 'TABLE' | 'HALL'>(existing?.appliesTo ?? 'ORDER');
  const [validFrom, setValidFrom] = useState(existing ? toDateInput(existing.validFrom) : new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(
    existing ? toDateInput(existing.validTo) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [usageLimit, setUsageLimit] = useState(existing?.usageLimit?.toString() ?? '');
  const [perUser, setPerUser] = useState(existing?.usageLimitPerUser?.toString() ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const value = Number(discountValue);

    if (discountType === 'PERCENT' && (value <= 0 || value > 100)) {
      setError('A percentage discount must be between 1 and 100.');
      return;
    }

    if (new Date(validTo) <= new Date(validFrom)) {
      setError('The valid-to date must be after the valid-from date.');
      return;
    }

    setBusy(true);

    try {
      const result = await adminApi.saveCoupon({
        couponId: existing?.couponId ?? 0,
        code: code.trim().toUpperCase(),
        title: title.trim(),
        description: description.trim() || null,
        discountType,
        discountValue: value,
        maxDiscountAmount: maxDiscount.trim() ? Number(maxDiscount) : null,
        minOrderAmount: Number(minOrder) || 0,
        restaurantId: restaurantId ? Number(restaurantId) : null,
        appliesTo,
        validFrom: new Date(`${validFrom}T00:00:00`).toISOString(),
        validTo: new Date(`${validTo}T23:59:59`).toISOString(),
        usageLimit: usageLimit.trim() ? Number(usageLimit) : null,
        usageLimitPerUser: perUser.trim() ? Number(perUser) : null,
        isActive,
      });

      if (result.couponId <= 0) {
        setError(result.message);
        return;
      }

      toast.success('Coupon saved.');
      onSaved();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
          ? err.detail
          : 'Could not save.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={existing ? `Edit ${existing.code}` : 'New coupon'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="coupon-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            Coupon save karo
          </button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cf-code" className="label">Coupon code</label>
            <input
              id="cf-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              required
              minLength={3}
              maxLength={40}
              placeholder="WELCOME50"
              className="input font-mono tracking-wider uppercase"
            />
          </div>

          <div>
            <label htmlFor="cf-title" className="label">Title (customer ko dikhega)</label>
            <input
              id="cf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={150}
              placeholder="50% OFF up to Rs 150"
              className="input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="cf-desc" className="label">Description</label>
          <textarea
            id="cf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={400}
            className="input resize-y"
          />
        </div>

        {/* ---- discount ---- */}
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
          <p className="mb-3 text-sm font-semibold text-ink-800">Discount</p>

          <div className="mb-3 flex gap-2">
            {(['PERCENT', 'FLAT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDiscountType(t)}
                className={`chip ${discountType === t ? 'chip-active' : ''}`}
              >
                {t === 'PERCENT' ? 'Percentage (%)' : 'Flat amount (Rs)'}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="cf-val" className="label">
                {discountType === 'PERCENT' ? 'Percent' : 'Amount (Rs)'}
              </label>
              <input
                id="cf-val"
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
                min={1}
                max={discountType === 'PERCENT' ? 100 : undefined}
                className="input"
              />
            </div>

            {discountType === 'PERCENT' && (
              <div>
                <label htmlFor="cf-max" className="label">Max discount (Rs)</label>
                <input
                  id="cf-max"
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  min={0}
                  placeholder="Optional"
                  className="input"
                />
              </div>
            )}

            <div>
              <label htmlFor="cf-min" className="label">Minimum order (Rs)</label>
              <input
                id="cf-min"
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                min={0}
                className="input"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-ink-500">
            Preview:{' '}
            {discountType === 'PERCENT'
              ? `${discountValue}% off${maxDiscount ? ` up to ${currency(Number(maxDiscount))}` : ''}`
              : `${currency(Number(discountValue) || 0)} off`}
            {Number(minOrder) > 0 ? ` - minimum ${currency(Number(minOrder))}` : ''}
          </p>
        </div>

        {/* ---- scope ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">What is it valid on?</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'ORDER', label: 'Food orders' },
                  { key: 'TABLE', label: 'Table booking' },
                  { key: 'HALL', label: 'Party halls' },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setAppliesTo(s.key)}
                  className={`chip ${appliesTo === s.key ? 'chip-active' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="cf-rest" className="label">Restaurant</label>
            <select
              id="cf-rest"
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="select"
            >
              <option value="">All restaurants</option>
              {restaurants.map((r) => (
                <option key={r.restaurantId} value={r.restaurantId}>
                  Sirf {r.name} - {r.locality}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---- validity + limits ---- */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="cf-from" className="label">Valid from</label>
            <input id="cf-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required className="input" />
          </div>

          <div>
            <label htmlFor="cf-to" className="label">Valid to</label>
            <input id="cf-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} required className="input" />
          </div>

          <div>
            <label htmlFor="cf-limit" className="label">Total limit</label>
            <input id="cf-limit" type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} min={1} placeholder="Unlimited" className="input" />
          </div>

          <div>
            <label htmlFor="cf-peruser" className="label">Per user limit</label>
            <input id="cf-peruser" type="number" value={perUser} onChange={(e) => setPerUser(e.target.value)} min={1} placeholder="Unlimited" className="input" />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 accent-brand-600" />
          <span className="text-sm text-ink-700">Live (customers can use it)</span>
        </label>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
