import { useState } from 'react';
import { manageApi } from '@/api/endpoints';
import {
  Badge, EmptyState, ErrorBanner, Modal, Pagination, RowsSkeleton, SafeImage,
  Spinner, StatusBadge, VegMark,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, useDebounced, usePageTitle } from '@/hooks/useAsync';
import type { Order, OrderStatus } from '@/types';
import { scopeOptions, useRestaurantScope } from './useRestaurantScope';

/* Har status ke liye agla valid step - SP ke rules ke hisaab se */
const NEXT_STEPS: Partial<Record<OrderStatus, { status: OrderStatus; label: string; tone: string }[]>> = {
  PLACED: [
    { status: 'CONFIRMED', label: 'Accept', tone: 'btn-success' },
    { status: 'REJECTED', label: 'Reject', tone: 'btn-danger' },
  ],
  CONFIRMED: [{ status: 'PREPARING', label: 'Start preparing', tone: 'btn-primary' }],
  PREPARING: [{ status: 'OUT_FOR_DELIVERY', label: 'Send out', tone: 'btn-primary' }],
  OUT_FOR_DELIVERY: [{ status: 'DELIVERED', label: 'Mark as delivered', tone: 'btn-success' }],
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'PLACED', label: 'New' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PREPARING', label: 'Being prepared' },
  { key: 'OUT_FOR_DELIVERY', label: 'Raste me' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function OrdersManager() {
  usePageTitle('Order management');

  const { currency } = useLocationCtx();
  const toast = useToast();
  const scope = useRestaurantScope();

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [page, setPage] = useState(1);
  const [allRestaurants, setAllRestaurants] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const canManage = allRestaurants ? scope.isAdmin : (scope.selected?.canManageOrder ?? false);

  const orders = useAsync(
    () =>
      manageApi.orders({
        restaurantId: allRestaurants ? undefined : (scope.selectedId ?? undefined),
        status: status || undefined,
        search: debouncedSearch || undefined,
        pageNumber: page,
        pageSize: 20,
      }),
    [allRestaurants, scope.selectedId, status, debouncedSearch, page],
  );

  const changeStatus = async (order: Order, next: OrderStatus) => {
    setBusyId(order.orderId);
    try {
      await manageApi.updateOrderStatus(order.orderId, next);
      toast.success(`${order.orderNumber} -> ${next.replaceAll('_', ' ')}`);
      orders.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update the status.');
    } finally {
      setBusyId(null);
    }
  };

  if (scope.isLoading) return <RowsSkeleton rows={4} />;
  if (scope.error) return <ErrorBanner message={scope.error} />;

  if (scope.restaurants.length === 0) {
    return (
      <EmptyState
        title="No restaurant assigned"
        description="Ask an admin to assign you a restaurant so orders appear here."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Order management</h1>
        <p className="text-sm text-ink-500">
          Accept orders, move them along and assign a delivery partner.
        </p>
      </div>

      {/* ---------------- scope + search ---------------- */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-56 flex-1">
          <label htmlFor="om-rest" className="label">
            Restaurant
          </label>
          <select
            id="om-rest"
            value={allRestaurants ? 'all' : (scope.selectedId ?? '')}
            onChange={(e) => {
              if (e.target.value === 'all') {
                setAllRestaurants(true);
              } else {
                setAllRestaurants(false);
                scope.setSelectedId(Number(e.target.value));
              }
              setPage(1);
            }}
            className="select"
          >
            {scope.isAdmin && <option value="all">All restaurants</option>}
            {scopeOptions(scope.restaurants).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-48 flex-1">
          <label htmlFor="om-search" className="label">
            Dhoondo
          </label>
          <input
            id="om-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Order number, customer ya phone"
            className="input"
          />
        </div>
      </div>

      {/* ---------------- status tabs ---------------- */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
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

      {!canManage && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {scope.selected?.name} ke orders manage karne ki permission nahi hai
          </p>
          <p className="mt-0.5 text-sm text-amber-800">You can view them, but you cannot change the status.</p>
        </div>
      )}

      {/* ---------------- list ---------------- */}
      {orders.error ? (
        <ErrorBanner message={orders.error} onRetry={orders.reload} />
      ) : orders.isLoading ? (
        <RowsSkeleton rows={5} />
      ) : (orders.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No orders found"
          description={status ? 'No orders with this status.' : 'No orders have come in yet.'}
        />
      ) : (
        <>
          <ul className="space-y-4">
            {orders.data!.items.map((o) => (
              <li key={o.orderId} className="card p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <SafeImage
                    src={o.restaurantImage}
                    alt={o.restaurantName}
                    className="size-14 shrink-0 rounded-xl object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-ink-900">{o.orderNumber}</p>
                      <StatusBadge status={o.status} />
                      <StatusBadge status={o.paymentStatus} />
                      <Badge tone={o.paymentMode === 'COD' ? 'amber' : 'blue'}>{o.paymentMode}</Badge>
                      {o.orderType === 'PICKUP' && <Badge>Pickup</Badge>}
                    </div>

                    <p className="mt-1 text-sm font-medium text-ink-800">
                      {o.customerName}
                      {o.customerPhone && (
                        <a href={`tel:${o.customerPhone}`} className="ml-2 text-brand-700 hover:underline">
                          {o.customerPhone}
                        </a>
                      )}
                    </p>

                    <p className="truncate text-xs text-ink-500">{o.restaurantName}</p>

                    {o.itemSummary && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-ink-600">{o.itemSummary}</p>
                    )}

                    <p className="mt-1.5 text-xs text-ink-400">
                      {new Date(o.placedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {o.orderType === 'DELIVERY' ? ` - ${o.distanceKm} km` : ''}
                      {o.etaMinutes ? ` - ETA ${o.etaMinutes} min` : ''}
                      {o.deliveryPersonName ? ` - ${o.deliveryPersonName}` : ''}
                    </p>

                    {o.customerNote && (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                        Note: {o.customerNote}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-ink-900">{currency(o.totalAmount)}</p>
                    <p className="text-xs text-ink-400">{o.itemCount} items</p>
                  </div>
                </div>

                {/* ---- delivery address ---- */}
                {o.orderType === 'DELIVERY' && (
                  <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                    {o.deliveryAddress}
                  </p>
                )}

                {/* ---- actions ---- */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setDetailId(o.orderId)}
                    className="btn-outline btn-sm"
                  >
                    Details
                  </button>

                  {canManage &&
                    NEXT_STEPS[o.status]?.map((step) => (
                      <button
                        key={step.status}
                        type="button"
                        onClick={() => changeStatus(o, step.status)}
                        disabled={busyId === o.orderId}
                        className={`${step.tone} btn-sm`}
                      >
                        {busyId === o.orderId && <Spinner className="size-3.5" />}
                        {step.label}
                      </button>
                    ))}

                  {canManage &&
                    ['CONFIRMED', 'PREPARING'].includes(o.status) &&
                    o.orderType === 'DELIVERY' && (
                      <button
                        type="button"
                        onClick={() => setAssignOrder(o)}
                        className="btn-outline btn-sm"
                      >
                        {o.deliveryPersonName ? 'Delivery badlo' : 'Assign delivery'}
                      </button>
                    )}

                  {canManage && ['PLACED', 'CONFIRMED', 'PREPARING'].includes(o.status) && (
                    <button
                      type="button"
                      onClick={() => changeStatus(o, 'CANCELLED')}
                      disabled={busyId === o.orderId}
                      className="btn-ghost btn-sm !text-brand-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            pageNumber={orders.data!.pageNumber}
            totalPages={orders.data!.totalPages}
            totalCount={orders.data!.totalCount}
            onChange={setPage}
          />
        </>
      )}

      {/* ==================== detail modal ==================== */}
      {detailId !== null && (
        <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />
      )}

      {/* ==================== assign delivery ==================== */}
      {assignOrder && (
        <AssignDeliveryModal
          order={assignOrder}
          onClose={() => setAssignOrder(null)}
          onAssigned={() => {
            setAssignOrder(null);
            orders.reload();
          }}
        />
      )}
    </div>
  );
}

/* ================================================================= */

function OrderDetailModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { currency } = useLocationCtx();
  const { data, isLoading, error } = useAsync(() => manageApi.orderDetail(orderId), [orderId]);

  return (
    <Modal open title={data ? `Order ${data.order.orderNumber}` : 'Order'} onClose={onClose} size="lg">
      {error ? (
        <ErrorBanner message={error} />
      ) : isLoading || !data ? (
        <RowsSkeleton rows={4} />
      ) : (
        <div className="space-y-5">
          {/* customer */}
          <section>
            <h3 className="mb-2 text-sm font-bold tracking-wide text-ink-500 uppercase">Customer</h3>
            <p className="text-sm font-semibold text-ink-900">{data.order.customerName}</p>
            <p className="text-sm text-ink-600">{data.order.customerEmail}</p>
            {data.order.customerPhone && (
              <a href={`tel:${data.order.customerPhone}`} className="text-sm font-semibold text-brand-700">
                {data.order.customerPhone}
              </a>
            )}
            <p className="mt-2 text-sm text-ink-600">{data.order.deliveryAddress}</p>
          </section>

          {/* items */}
          <section>
            <h3 className="mb-2 text-sm font-bold tracking-wide text-ink-500 uppercase">Items</h3>
            <ul className="divide-y divide-ink-100">
              {data.items.map((it) => (
                <li key={it.orderItemId} className="flex items-center gap-3 py-2.5">
                  <SafeImage src={it.itemImage} alt={it.itemName} className="size-11 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {it.isVeg !== undefined && <VegMark isVeg={it.isVeg} />}
                      <p className="truncate text-sm font-semibold text-ink-900">{it.itemName}</p>
                    </div>
                    <p className="text-xs text-ink-500">
                      {currency(it.unitPrice)} x {it.quantity}
                    </p>
                    {it.notes && <p className="text-xs text-ink-400 italic">{it.notes}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-bold">{currency(it.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* bill */}
          <section className="rounded-xl bg-ink-50 p-4">
            <h3 className="mb-2 text-sm font-bold tracking-wide text-ink-500 uppercase">Bill</h3>
            <dl className="space-y-1.5 text-sm">
              <BillRow label="Sub total" value={currency(data.order.subTotal)} />
              {data.order.discountAmount > 0 && (
                <BillRow
                  label={`Discount ${data.order.couponCode ?? ''}`}
                  value={`- ${currency(data.order.discountAmount)}`}
                />
              )}
              <BillRow label="Delivery" value={currency(data.order.deliveryFee)} />
              <BillRow label="Packaging" value={currency(data.order.packagingFee)} />
              <BillRow label="Tax" value={currency(data.order.taxAmount)} />
              <div className="border-t border-ink-200 pt-1.5">
                <BillRow label="Total" value={currency(data.order.totalAmount)} bold />
              </div>
            </dl>
          </section>

          {/* timeline */}
          <section>
            <h3 className="mb-2 text-sm font-bold tracking-wide text-ink-500 uppercase">Timeline</h3>
            <ul className="space-y-2">
              {data.timeline.map((t) => (
                <li key={t.historyId} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink-300" />
                  <div>
                    <p className="font-medium text-ink-800">{t.status.replaceAll('_', ' ')}</p>
                    {t.remarks && <p className="text-xs text-ink-500">{t.remarks}</p>}
                    <p className="text-xs text-ink-400">
                      {new Date(t.changedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {t.changedBy ? ` - ${t.changedBy}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}

function BillRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={bold ? 'font-bold text-ink-900' : 'text-ink-600'}>{label}</dt>
      <dd className={bold ? 'font-bold text-ink-900' : 'font-medium text-ink-800'}>{value}</dd>
    </div>
  );
}

/* ================================================================= */

function AssignDeliveryModal({
  order,
  onClose,
  onAssigned,
}: {
  order: Order;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(order.deliveryEmployeeId ?? null);
  const [busy, setBusy] = useState(false);

  const staff = useAsync(() => manageApi.deliveryStaff(order.restaurantId), [order.restaurantId]);

  const assign = async () => {
    if (selected === null) return;

    setBusy(true);
    try {
      await manageApi.assignDelivery(order.orderId, selected);
      toast.success('Delivery partner assigned.');
      onAssigned();
    } catch (err) {
      toast.fromError(err, 'Could not assign.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`${order.orderNumber} - assign delivery`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={assign}
            className="btn-primary"
            disabled={busy || selected === null}
          >
            {busy && <Spinner className="size-4" />}
            Assign karo
          </button>
        </>
      }
    >
      {staff.error ? (
        <ErrorBanner message={staff.error} onRetry={staff.reload} />
      ) : staff.isLoading ? (
        <RowsSkeleton rows={3} />
      ) : (staff.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No employees at this restaurant"
          description="First assign an employee to this restaurant from Admin panel > Employees."
        />
      ) : (
        <div className="space-y-2.5">
          <p className="text-sm text-ink-500">
            Sirf {order.restaurantName} par assigned employees hi list me hain.
          </p>

          {staff.data!.map((e) => (
            <label
              key={e.userId}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition ${
                selected === e.userId ? 'border-brand-600 bg-brand-50' : 'border-ink-200 hover:border-ink-300'
              }`}
            >
              <input
                type="radio"
                name="delivery-staff"
                checked={selected === e.userId}
                onChange={() => setSelected(e.userId)}
                className="size-4 accent-brand-600"
              />

              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {e.fullName.charAt(0)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{e.fullName}</span>
                <span className="block truncate text-xs text-ink-500">
                  {e.designations ?? 'Employee'} - {e.deliveredOrders} deliveries
                </span>
              </span>

              {!e.isActive && <Badge tone="red">Inactive</Badge>}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
