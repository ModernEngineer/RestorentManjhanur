import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orderApi } from '@/api/endpoints';
import {
  ConfirmDialog, EmptyState, ErrorBanner, Pagination, RowsSkeleton, SafeImage, StatusBadge,
} from '@/components/ui';
import { useCart } from '@/context/CartContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PLACED', label: 'Placed' },
  { key: 'PREPARING', label: 'Being prepared' },
  { key: 'OUT_FOR_DELIVERY', label: 'Raste me' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function MyOrders() {
  usePageTitle('My orders');

  const { currency } = useLocationCtx();
  const toast = useToast();
  const cart = useCart();
  const navigate = useNavigate();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const { data, isLoading, error, reload } = useAsync(
    () => orderApi.my({ status: status || undefined, pageNumber: page, pageSize: 10 }),
    [status, page],
  );

  const cancelOrder = async () => {
    if (cancelId === null) return;

    setCancelBusy(true);
    try {
      await orderApi.cancel(cancelId, 'Customer ne cancel kiya');
      toast.success('Order cancelled.');
      setCancelId(null);
      reload();
    } catch (err) {
      toast.fromError(err, 'Could not cancel.');
    } finally {
      setCancelBusy(false);
    }
  };

  const reorder = async (orderId: number) => {
    try {
      const data = await orderApi.reorder(orderId);
      const available = data.items.filter((i) => i.isAvailable);

      if (available.length === 0) {
        toast.error('None of the items from this order are available now.');
        return;
      }

      cart.loadLines(
        { id: data.restaurantId, name: data.restaurantName, slug: data.restaurantSlug },
        available.map((i) => ({
          foodItemId: i.foodItemId,
          name: i.name,
          price: 0, // asli price restaurant page / checkout par server se aata hai
          imageUrl: i.image ?? null,
          isVeg: true,
          quantity: i.quantity,
        })),
      );

      if (data.unavailableCount > 0) {
        toast.info(`${data.unavailableCount} item is no longer available; the rest were added to your cart.`);
      }

      navigate(`/restaurant/${data.restaurantSlug}`);
    } catch (err) {
      toast.fromError(err, 'Could not reorder.');
    }
  };

  return (
    <div className="container-app py-6">
      <h1 className="mb-1 text-2xl font-bold text-ink-900 sm:text-3xl">My orders</h1>
      <p className="mb-5 text-sm text-ink-500">All your orders, their status and bills are here.</p>

      {/* ---- status tabs ---- */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {STATUS_TABS.map((t) => (
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

      {error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : isLoading ? (
        <RowsSkeleton rows={4} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No orders found"
          description={status ? 'No orders with this status.' : 'You have not ordered anything yet. Get started!'}
          action={
            <Link to="/restaurants" className="btn-primary">
              Browse restaurants
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-4">
            {data!.items.map((o) => (
              <li key={o.orderId} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <SafeImage
                    src={o.restaurantImage}
                    alt={o.restaurantName}
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-ink-900">
                        {o.restaurantName}
                      </h2>
                      <StatusBadge status={o.status} />
                      <StatusBadge status={o.paymentStatus} />
                    </div>

                    <p className="mt-0.5 font-mono text-xs text-ink-400">{o.orderNumber}</p>

                    {o.itemSummary && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-ink-600">{o.itemSummary}</p>
                    )}

                    <p className="mt-1.5 text-xs text-ink-400">
                      {new Date(o.placedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {o.orderType === 'PICKUP' ? ' - Pickup' : ` - ${o.distanceKm} km`}
                      {o.deliveryPersonName ? ` - ${o.deliveryPersonName} is bringing it` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-ink-900">{currency(o.totalAmount)}</p>
                    <p className="text-xs text-ink-400">
                      {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'} - {o.paymentMode}
                    </p>
                  </div>
                </div>

                {/* ---- actions ---- */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  <Link to={`/my-orders/${o.orderId}`} className="btn-outline btn-sm">
                    View details
                  </Link>

                  <button type="button" onClick={() => reorder(o.orderId)} className="btn-outline btn-sm">
                    Order again
                  </button>

                  {['PLACED', 'CONFIRMED', 'PREPARING'].includes(o.status) && (
                    <button
                      type="button"
                      onClick={() => setCancelId(o.orderId)}
                      className="btn-ghost btn-sm !text-brand-700"
                    >
                      Cancel
                    </button>
                  )}

                  {o.status === 'DELIVERED' && (
                    <Link
                      to={`/restaurant/${o.restaurantSlug ?? ''}#reviews`}
                      className="btn-ghost btn-sm !text-brand-700"
                    >
                      Review likho
                    </Link>
                  )}

                  {o.status === 'PLACED' && o.paymentMode === 'ONLINE' && o.paymentStatus === 'PENDING' && (
                    <Link to={`/my-orders/${o.orderId}`} className="btn-primary btn-sm">
                      Complete payment
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <Pagination
              pageNumber={data!.pageNumber}
              totalPages={data!.totalPages}
              totalCount={data!.totalCount}
              onChange={setPage}
            />
          </div>
        </>
      )}

      <ConfirmDialog
        open={cancelId !== null}
        title="Cancel this order?"
        message="This cannot be undone. If the payment has already gone through, a refund will be processed."
        confirmLabel="Yes, cancel it"
        cancelLabel="No, keep it"
        danger
        busy={cancelBusy}
        onConfirm={cancelOrder}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
}
