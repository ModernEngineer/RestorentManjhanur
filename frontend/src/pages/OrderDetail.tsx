import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi, paymentApi } from '@/api/endpoints';
import { CheckoutCancelledError, runCheckout } from '@/api/payment';
import {
  Badge, ErrorBanner, PageLoader, SafeImage, Spinner, StatusBadge, VegMark,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';
import type { OrderStatus } from '@/types';

/** Progress steps - jo status DB me hain unhi ka order. */
const FLOW: { status: OrderStatus; label: string; text: string }[] = [
  { status: 'PLACED', label: 'Order placed', text: 'Sent to the restaurant' },
  { status: 'CONFIRMED', label: 'Confirmed', text: 'Restaurant ne accept kiya' },
  { status: 'PREPARING', label: 'Being prepared', text: 'Being prepared in the kitchen' },
  { status: 'OUT_FOR_DELIVERY', label: 'Raste me', text: 'The delivery partner has left' },
  { status: 'DELIVERED', label: 'Delivered', text: 'Your food has arrived' },
];

export default function OrderDetail() {
  const { orderId = '' } = useParams();
  const { currency } = useLocationCtx();
  const { user } = useAuth();
  const toast = useToast();
  const [paying, setPaying] = useState(false);

  const { data, isLoading, error, reload } = useAsync(
    () => orderApi.detail(Number(orderId)),
    [orderId],
  );

  usePageTitle(data ? `Order ${data.order.orderNumber}` : 'Order');

  const completePayment = async () => {
    if (!data) return;

    setPaying(true);
    try {
      const intent = await paymentApi.create({ orderId: data.order.orderId, purposeType: 'ORDER' });

      const checkout = await runCheckout(intent, {
        name: user?.fullName,
        email: user?.email,
        contact: user?.phone ?? undefined,
        description: `Order ${data.order.orderNumber}`,
      });

      await paymentApi.verify({
        paymentRef: intent.paymentRef,
        gatewayOrderId: checkout.gatewayOrderId,
        gatewayPaymentId: checkout.gatewayPaymentId,
        signature: checkout.signature,
        method: checkout.method,
      });

      toast.success('Payment successful! Your order is confirmed.');
      reload();
    } catch (err) {
      if (err instanceof CheckoutCancelledError) {
        toast.info('Payment cancelled.');
        return;
      }
      toast.fromError(err, 'Could not complete the payment.');
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading order..." />;

  if (error || !data) {
    return (
      <div className="container-app py-10">
        <ErrorBanner message={error ?? 'Order not found.'} onRetry={reload} />
        <Link to="/my-orders" className="btn-outline mt-4">
          My orders
        </Link>
      </div>
    );
  }

  const o = data.order;
  const cancelled = o.status === 'CANCELLED' || o.status === 'REJECTED';
  const currentStep = FLOW.findIndex((f) => f.status === o.status);

  return (
    <div className="container-app py-6">
      {/* ---------------- header ---------------- */}
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-ink-400">
        <Link to="/" className="hover:text-ink-700">Home</Link>
        <span>/</span>
        <Link to="/my-orders" className="hover:text-ink-700">My orders</Link>
        <span>/</span>
        <span className="text-ink-700">{o.orderNumber}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-900">{o.orderNumber}</h1>
            <StatusBadge status={o.status} />
            <StatusBadge status={o.paymentStatus} />
          </div>

          <p className="mt-1 text-sm text-ink-500">
            {new Date(o.placedAt).toLocaleString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {o.paymentMode === 'ONLINE' && o.paymentStatus === 'PENDING' && !cancelled && (
          <button type="button" onClick={completePayment} disabled={paying} className="btn-primary">
            {paying && <Spinner className="size-4" />}
            Complete payment - {currency(o.totalAmount)}
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ==================== left ==================== */}
        <div className="space-y-5">
          {/* ---- progress ---- */}
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-ink-900">Order ka status</h2>

            {cancelled ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-4">
                <p className="font-semibold text-brand-800">
                  Ye order {o.status === 'CANCELLED' ? 'cancel' : 'reject'} ho gaya
                </p>
                {o.cancelReason && <p className="mt-1 text-sm text-brand-700">{o.cancelReason}</p>}
                {o.paymentStatus === 'REFUNDED' && (
                  <p className="mt-2 text-sm font-medium text-brand-800">
                    The payment has been refunded.
                  </p>
                )}
              </div>
            ) : (
              <ol className="space-y-0">
                {FLOW.map((f, i) => {
                  const done = i <= currentStep;
                  const active = i === currentStep;

                  return (
                    <li key={f.status} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
                            done ? 'bg-rating-500 text-white' : 'bg-ink-100 text-ink-400'
                          }`}
                        >
                          {done ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3.5">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            i + 1
                          )}
                        </span>

                        {i < FLOW.length - 1 && (
                          <span
                            className={`my-1 w-0.5 flex-1 ${i < currentStep ? 'bg-rating-500' : 'bg-ink-100'}`}
                            style={{ minHeight: '1.5rem' }}
                          />
                        )}
                      </div>

                      <div className="pb-5">
                        <p className={`text-sm font-semibold ${done ? 'text-ink-900' : 'text-ink-400'}`}>
                          {f.label}
                          {active && o.etaMinutes && o.status !== 'DELIVERED' && (
                            <span className="ml-2 text-xs font-normal text-brand-600">
                              ETA {o.etaMinutes} min
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-500">{f.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {o.deliveryPersonName && (
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {o.deliveryPersonName.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">{o.deliveryPersonName}</p>
                  <p className="text-xs text-ink-500">Your delivery partner</p>
                </div>
                {o.deliveryPersonPhone && (
                  <a href={`tel:${o.deliveryPersonPhone}`} className="btn-outline btn-sm">
                    Call
                  </a>
                )}
              </div>
            )}
          </section>

          {/* ---- items ---- */}
          <section className="card p-5">
            <div className="mb-3 flex items-center gap-3">
              <SafeImage
                src={o.restaurantImage}
                alt={o.restaurantName}
                className="size-12 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-ink-900">{o.restaurantName}</h2>
                <p className="truncate text-xs text-ink-500">
                  {o.locality}, {o.city}
                </p>
              </div>
              {o.restaurantPhone && (
                <a href={`tel:${o.restaurantPhone}`} className="btn-outline btn-sm ml-auto shrink-0">
                  Call
                </a>
              )}
            </div>

            <ul className="divide-y divide-ink-100">
              {data.items.map((it) => (
                <li key={it.orderItemId} className="flex items-center gap-3 py-3">
                  <SafeImage src={it.itemImage} alt={it.itemName} className="size-12 shrink-0 rounded-lg object-cover" />

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

                  <p className="shrink-0 text-sm font-bold text-ink-900">{currency(it.lineTotal)}</p>
                </li>
              ))}
            </ul>

            {o.customerNote && (
              <p className="mt-3 rounded-lg bg-ink-50 px-3.5 py-2.5 text-sm text-ink-600">
                <strong>Your note:</strong> {o.customerNote}
              </p>
            )}
          </section>

          {/* ---- timeline ---- */}
          {data.timeline.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold text-ink-900">Activity log</h2>

              <ul className="space-y-3">
                {data.timeline.map((t) => (
                  <li key={t.historyId} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink-300" />
                    <div className="min-w-0 flex-1">
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
          )}
        </div>

        {/* ==================== right ==================== */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {/* ---- bill ---- */}
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Bill</h2>

            <dl className="space-y-2 text-sm">
              <Row label="Item total" value={currency(o.subTotal)} />
              {o.discountAmount > 0 && (
                <Row
                  label={`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`}
                  value={`- ${currency(o.discountAmount)}`}
                  tone="green"
                />
              )}
              <Row
                label="Delivery fee"
                value={o.deliveryFee === 0 ? 'FREE' : currency(o.deliveryFee)}
                tone={o.deliveryFee === 0 ? 'green' : undefined}
              />
              <Row label="Packaging" value={currency(o.packagingFee)} />
              <Row label="Taxes" value={currency(o.taxAmount)} />

              <div className="border-t border-ink-100 pt-2.5">
                <Row label="Total" value={currency(o.totalAmount)} bold />
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={o.paymentMode === 'COD' ? 'amber' : 'blue'}>{o.paymentMode}</Badge>
              <Badge tone={o.paymentStatus === 'PAID' ? 'green' : 'gray'}>{o.paymentStatus}</Badge>
            </div>
          </section>

          {/* ---- delivery address ---- */}
          <section className="card p-5">
            <h2 className="mb-2 text-base font-semibold text-ink-900">
              {o.orderType === 'PICKUP' ? 'Pickup' : 'Delivery address'}
            </h2>
            <p className="text-sm leading-relaxed text-ink-600">{o.deliveryAddress}</p>
            {o.orderType === 'DELIVERY' && (
              <p className="mt-2 text-xs text-ink-400">Restaurant se {o.distanceKm} km</p>
            )}
          </section>

          {/* ---- payments ---- */}
          {data.payments.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold text-ink-900">Payment history</h2>

              <ul className="space-y-3">
                {data.payments.map((p) => (
                  <li key={p.paymentId} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink-800">{currency(p.amount)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] break-all text-ink-400">{p.paymentRef}</p>
                    <p className="text-xs text-ink-400">
                      {p.gatewayName}
                      {p.method ? ` - ${p.method}` : ''}
                      {p.completedAt
                        ? ` - ${new Date(p.completedAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : ''}
                    </p>
                    {p.failureReason && <p className="text-xs text-brand-700">{p.failureReason}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: 'green';
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={bold ? 'font-bold text-ink-900' : 'text-ink-600'}>{label}</dt>
      <dd
        className={`${bold ? 'text-base font-bold text-ink-900' : 'font-medium text-ink-800'} ${
          tone === 'green' ? '!text-rating-500' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
