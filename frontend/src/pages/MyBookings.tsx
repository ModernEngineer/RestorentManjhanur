import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hallApi, paymentApi, tableBookingApi } from '@/api/endpoints';
import { CheckoutCancelledError, runCheckout } from '@/api/payment';
import {
  Badge, ConfirmDialog, EmptyState, ErrorBanner, RowsSkeleton, SafeImage, Spinner, StatusBadge,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

type Tab = 'tables' | 'halls';

export default function MyBookings() {
  usePageTitle('My bookings');

  const { currency } = useLocationCtx();
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('tables');
  const [cancel, setCancel] = useState<{ kind: Tab; id: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

  const tables = useAsync(() => tableBookingApi.my({ pageSize: 50 }), []);
  const halls = useAsync(() => hallApi.myBookings({ pageSize: 50 }), []);

  const doCancel = async () => {
    if (!cancel) return;

    setBusy(true);
    try {
      if (cancel.kind === 'tables') {
        await tableBookingApi.cancel(cancel.id);
        tables.reload();
      } else {
        await hallApi.cancelBooking(cancel.id);
        halls.reload();
      }
      toast.success('Booking cancelled.');
      setCancel(null);
    } catch (err) {
      toast.fromError(err, 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  };

  const payAdvance = async (bookingId: number) => {
    setPayingId(bookingId);
    try {
      const intent = await paymentApi.create({ hallBookingId: bookingId, purposeType: 'HALL' });

      const checkout = await runCheckout(intent, {
        name: user?.fullName,
        email: user?.email,
        contact: user?.phone ?? undefined,
        description: `Hall booking advance - ${intent.receipt}`,
      });

      await paymentApi.verify({
        paymentRef: intent.paymentRef,
        gatewayOrderId: checkout.gatewayOrderId,
        gatewayPaymentId: checkout.gatewayPaymentId,
        signature: checkout.signature,
        method: checkout.method,
      });

      toast.success(`Advance of ${currency(intent.amount)} paid - booking CONFIRMED!`);
      halls.reload();
    } catch (err) {
      if (err instanceof CheckoutCancelledError) {
        toast.info('Payment cancelled. The booking is still pending.');
        return;
      }
      toast.fromError(err, 'The payment did not go through.');
    } finally {
      setPayingId(null);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="container-app py-6">
      <h1 className="mb-1 text-2xl font-bold text-ink-900 sm:text-3xl">My bookings</h1>
      <p className="mb-5 text-sm text-ink-500">Table reservations aur party hall bookings.</p>

      {/* ---- tabs ---- */}
      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('tables')}
          className={`chip ${tab === 'tables' ? 'chip-active' : ''}`}
        >
          Table bookings ({tables.data?.totalCount ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('halls')}
          className={`chip ${tab === 'halls' ? 'chip-active' : ''}`}
        >
          Hall bookings ({halls.data?.totalCount ?? 0})
        </button>
      </div>

      {/* ==================== TABLE BOOKINGS ==================== */}
      {tab === 'tables' &&
        (tables.error ? (
          <ErrorBanner message={tables.error} onRetry={tables.reload} />
        ) : tables.isLoading ? (
          <RowsSkeleton rows={3} />
        ) : (tables.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No table bookings"
            description="You can reserve from a restaurant page using 'Book a table'."
            action={
              <Link to="/dining" className="btn-primary">
                Browse dining out
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4">
            {tables.data!.items.map((b) => (
              <li key={b.bookingId} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <SafeImage
                    src={b.restaurantImage}
                    alt={b.restaurantName}
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-ink-900">
                        {b.restaurantName}
                      </h2>
                      <StatusBadge status={b.status} />
                    </div>

                    <p className="mt-0.5 font-mono text-xs text-ink-400">{b.bookingNumber}</p>

                    <p className="mt-1.5 text-sm text-ink-700">
                      {fmtDate(b.bookingDate)} - {b.bookingTime?.slice(0, 5)} - {b.guestCount}{' '}
                      {b.guestCount === 1 ? 'guest' : 'guests'}
                    </p>

                    <p className="mt-0.5 text-xs text-ink-500">
                      {b.tableNumber ? `Table ${b.tableNumber} (${b.tableLocation})` : 'Table to be assigned'}
                      {b.occasion && b.occasion !== 'Casual' ? ` - ${b.occasion}` : ''}
                    </p>

                    {b.specialRequest && (
                      <p className="mt-1.5 text-xs text-ink-500 italic">"{b.specialRequest}"</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right text-xs text-ink-400">
                    <p>{b.guestName}</p>
                    <p>{b.guestPhone}</p>
                  </div>
                </div>

                {['PENDING', 'CONFIRMED'].includes(b.status) && (
                  <div className="mt-3 border-t border-ink-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setCancel({ kind: 'tables', id: b.bookingId })}
                      className="btn-ghost btn-sm !text-brand-700"
                    >
                      Cancel booking
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}

      {/* ==================== HALL BOOKINGS ==================== */}
      {tab === 'halls' &&
        (halls.error ? (
          <ErrorBanner message={halls.error} onRetry={halls.reload} />
        ) : halls.isLoading ? (
          <RowsSkeleton rows={3} />
        ) : (halls.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No hall bookings"
            description="Book a hall for a birthday or party - decoration and cake included."
            action={
              <Link to="/party-halls" className="btn-primary">
                Browse party halls
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4">
            {halls.data!.items.map((b) => {
              const advanceDue = Math.round(b.totalAmount * 0.3 * 100) / 100;

              return (
                <li key={b.bookingId} className="card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <SafeImage
                      src={b.hallImage}
                      alt={b.hallName}
                      className="size-16 shrink-0 rounded-xl object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-ink-900">
                          {b.hallName}
                        </h2>
                        <Badge tone="purple">{b.eventType}</Badge>
                        <StatusBadge status={b.status} />
                        <StatusBadge status={b.paymentStatus} />
                      </div>

                      <p className="mt-0.5 font-mono text-xs text-ink-400">{b.bookingNumber}</p>

                      <p className="mt-1 truncate text-sm text-ink-600">
                        {b.restaurantName} - {b.locality}, {b.city}
                      </p>

                      <p className="mt-1.5 text-sm text-ink-700">
                        {fmtDate(b.eventDate)} - {b.startTime?.slice(0, 5)} to{' '}
                        {b.endTime?.slice(0, 5)} - {b.guestCount} guests
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {b.decorationTheme && <Badge tone="amber">Decor: {b.decorationTheme}</Badge>}
                        {b.cakeRequired && (
                          <Badge tone="blue">
                            Cake: {b.cakeFlavour} {b.cakeWeightKg}kg
                          </Badge>
                        )}
                        {b.menuPreference && <Badge>{b.menuPreference}</Badge>}
                        {b.couponCode && <Badge tone="green">{b.couponCode}</Badge>}
                      </div>

                      {b.specialRequest && (
                        <p className="mt-2 text-xs text-ink-500 italic">"{b.specialRequest}"</p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-ink-900">{currency(b.totalAmount)}</p>
                      <p className="text-xs text-ink-400">
                        {b.advanceAmount > 0
                          ? `${currency(b.advanceAmount)} advance paid`
                          : `${currency(advanceDue)} advance due`}
                      </p>
                    </div>
                  </div>

                  {/* ---- bill breakdown ---- */}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-ink-100 pt-3 text-xs sm:grid-cols-4">
                    <BillCell label="Hall rent" value={currency(b.baseRent)} />
                    <BillCell label="Plates" value={currency(b.plateAmount)} />
                    {b.decorationCharge > 0 && (
                      <BillCell label="Decor + cake" value={currency(b.decorationCharge)} />
                    )}
                    {b.discountAmount > 0 && (
                      <BillCell label="Discount" value={`- ${currency(b.discountAmount)}`} tone="green" />
                    )}
                    <BillCell label="GST" value={currency(b.taxAmount)} />
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                    {b.paymentStatus !== 'PAID' && !['CANCELLED', 'REJECTED'].includes(b.status) && (
                      <button
                        type="button"
                        onClick={() => payAdvance(b.bookingId)}
                        disabled={payingId === b.bookingId}
                        className="btn-primary btn-sm"
                      >
                        {payingId === b.bookingId && <Spinner className="size-3.5" />}
                        Advance pay karo - {currency(advanceDue)}
                      </button>
                    )}

                    {['PENDING', 'CONFIRMED'].includes(b.status) && (
                      <button
                        type="button"
                        onClick={() => setCancel({ kind: 'halls', id: b.bookingId })}
                        className="btn-ghost btn-sm !text-brand-700"
                      >
                        Cancel booking
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      <ConfirmDialog
        open={cancel !== null}
        title="Cancel this booking?"
        message={
          cancel?.kind === 'halls'
            ? 'The hall booking will be cancelled. If an advance was paid, a refund will be processed.'
            : 'The table booking will be cancelled. You can book again if needed.'
        }
        confirmLabel="Yes, cancel it"
        cancelLabel="No, keep it"
        danger
        busy={busy}
        onConfirm={doCancel}
        onCancel={() => setCancel(null)}
      />
    </div>
  );
}

function BillCell({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <div>
      <dt className="text-ink-400">{label}</dt>
      <dd className={`font-semibold ${tone === 'green' ? 'text-rating-500' : 'text-ink-700'}`}>
        {value}
      </dd>
    </div>
  );
}
