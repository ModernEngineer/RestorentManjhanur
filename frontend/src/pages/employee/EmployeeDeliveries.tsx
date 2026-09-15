import { useState } from 'react';
import { employeeApi } from '@/api/endpoints';
import {
  Badge, EmptyState, ErrorBanner, Pagination, RowsSkeleton, Spinner, StatusBadge,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

const TABS = [
  { key: '', label: 'Sab' },
  { key: 'PREPARING', label: 'Being prepared' },
  { key: 'OUT_FOR_DELIVERY', label: 'Raste me' },
  { key: 'DELIVERED', label: 'Completed' },
];

export default function EmployeeDeliveries() {
  usePageTitle('My deliveries');

  const { currency } = useLocationCtx();
  const toast = useToast();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);

  const deliveries = useAsync(
    () =>
      employeeApi.myDeliveries({
        status: status || undefined,
        pageNumber: page,
        pageSize: 20,
      }),
    [status, page],
  );

  const update = async (orderId: number, next: 'OUT_FOR_DELIVERY' | 'DELIVERED') => {
    setBusyId(orderId);
    try {
      await employeeApi.updateMyDelivery(orderId, next);
      toast.success(
        next === 'DELIVERED' ? 'Delivery complete! Shabaash.' : 'Order marked as picked up.',
      );
      deliveries.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My deliveries</h1>
        <p className="text-sm text-ink-500">
          Update the status of the orders assigned to you from here.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={`chip ${status === t.key ? 'chip-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {deliveries.error ? (
        <ErrorBanner message={deliveries.error} onRetry={deliveries.reload} />
      ) : deliveries.isLoading ? (
        <RowsSkeleton rows={4} />
      ) : (deliveries.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No deliveries assigned"
          description="When a manager assigns you an order, it will show up here."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {deliveries.data!.items.map((o) => (
              <li key={o.orderId} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-ink-900">{o.orderNumber}</p>
                      <StatusBadge status={o.status} />
                      <Badge tone={o.paymentMode === 'COD' ? 'amber' : 'blue'}>{o.paymentMode}</Badge>
                      <StatusBadge status={o.paymentStatus} />
                    </div>

                    <p className="mt-1.5 text-sm font-semibold text-ink-800">{o.restaurantName}</p>

                    <p className="mt-1 text-sm text-ink-700">
                      {o.customerName}
                      {o.customerPhone && (
                        <a href={`tel:${o.customerPhone}`} className="ml-2 font-semibold text-brand-700 hover:underline">
                          {o.customerPhone}
                        </a>
                      )}
                    </p>

                    <p className="mt-1.5 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
                      {o.deliveryAddress}
                    </p>

                    {o.itemSummary && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-ink-500">{o.itemSummary}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-ink-900">{currency(o.totalAmount)}</p>
                    <p className="text-xs text-ink-400">{o.distanceKm} km</p>

                    {o.paymentMode === 'COD' && o.paymentStatus !== 'PAID' && (
                      <p className="mt-1 text-xs font-bold text-amber-700">
                        Cash lena hai: {currency(o.totalAmount)}
                      </p>
                    )}
                  </div>
                </div>

                {/* ---- actions ---- */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  {o.status === 'PREPARING' && (
                    <button
                      type="button"
                      onClick={() => update(o.orderId, 'OUT_FOR_DELIVERY')}
                      disabled={busyId === o.orderId}
                      className="btn-primary btn-sm"
                    >
                      {busyId === o.orderId && <Spinner className="size-3.5" />}
                      Pick up kar liya
                    </button>
                  )}

                  {o.status === 'OUT_FOR_DELIVERY' && (
                    <button
                      type="button"
                      onClick={() => update(o.orderId, 'DELIVERED')}
                      disabled={busyId === o.orderId}
                      className="btn-success btn-sm"
                    >
                      {busyId === o.orderId && <Spinner className="size-3.5" />}
                      Deliver kar diya
                    </button>
                  )}

                  {o.deliveryLatitude !== undefined && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.deliveryAddress)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn-outline btn-sm"
                    >
                      Maps par kholo
                    </a>
                  )}

                  {o.status === 'DELIVERED' && o.deliveredAt && (
                    <span className="self-center text-xs text-ink-400">
                      Delivered{' '}
                      {new Date(o.deliveredAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            pageNumber={deliveries.data!.pageNumber}
            totalPages={deliveries.data!.totalPages}
            totalCount={deliveries.data!.totalCount}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
