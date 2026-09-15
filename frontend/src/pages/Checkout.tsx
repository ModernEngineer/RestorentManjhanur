import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { authApi, orderApi, paymentApi, restaurantApi } from '@/api/endpoints';
import { CheckoutCancelledError, runCheckout } from '@/api/payment';
import AddressForm from '@/components/AddressForm';
import DeliveryRateCard from '@/components/DeliveryRateCard';
import { Badge, EmptyState, PageLoader, SafeImage, Spinner, VegMark } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';
import type { CouponValidation, DeliverabilityCheck } from '@/types';

type Step = 'address' | 'paying' | 'done';

export default function Checkout() {
  usePageTitle('Checkout');

  const cart = useCart();
  const { user } = useAuth();
  const { currency, settings } = useLocationCtx();
  const toast = useToast();
  const navigate = useNavigate();

  const [addressId, setAddressId] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMode, setPaymentMode] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [note, setNote] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const [deliverability, setDeliverability] = useState<DeliverabilityCheck | null>(null);
  const [step, setStep] = useState<Step>('address');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  /* ---------------- addresses ---------------- */
  const { data: addresses, isLoading: addrLoading, reload: reloadAddresses } = useAsync(
    () => authApi.addresses(),
    [],
  );

  /* default address auto-select */
  useEffect(() => {
    if (addressId !== null || !addresses?.length) return;
    setAddressId((addresses.find((a) => a.isDefault) ?? addresses[0]).addressId);
  }, [addresses, addressId]);

  /* ---------------- available coupons ---------------- */
  const { data: availableCoupons } = useAsync(
    () =>
      cart.restaurantId
        ? orderApi.coupons({ restaurantId: cart.restaurantId, appliesTo: 'ORDER' })
        : Promise.resolve([]),
    [cart.restaurantId],
  );

  /* ---------------- 15 km deliverability check ---------------- */
  const selectedAddress = useMemo(
    () => addresses?.find((a) => a.addressId === addressId) ?? null,
    [addresses, addressId],
  );

  useEffect(() => {
    if (!cart.restaurantId || !selectedAddress || orderType !== 'DELIVERY') {
      setDeliverability(null);
      return;
    }

    let active = true;

    restaurantApi
      .deliverable(cart.restaurantId, selectedAddress.latitude, selectedAddress.longitude)
      .then((res) => {
        if (active) setDeliverability(res);
      })
      .catch(() => {
        if (active) setDeliverability(null);
      });

    return () => {
      active = false;
    };
  }, [cart.restaurantId, selectedAddress, orderType]);

  /* ---------------- bill ---------------- */
  const bill = useMemo(() => {
    const subTotal = cart.subTotal;
    const discount = coupon?.isValid ? coupon.discountAmount : 0;

    const deliveryFee =
      orderType === 'PICKUP' ? 0 : (deliverability?.deliveryFee ?? 0) < 0 ? 0 : (deliverability?.deliveryFee ?? 0);

    const packagingFee = subTotal < 300
      ? Number(settings.PackagingFeeSmall ?? 15)
      : Number(settings.PackagingFeeLarge ?? 25);

    const gstPercent = Number(settings.GstPercentFood ?? 5);
    const taxable = Math.max(subTotal - discount, 0);
    const tax = Math.round(taxable * (gstPercent / 100) * 100) / 100;

    return {
      subTotal,
      discount,
      deliveryFee,
      packagingFee,
      tax,
      gstPercent,
      total: taxable + deliveryFee + packagingFee + tax,
    };
  }, [cart.subTotal, coupon, deliverability, orderType, settings]);

  /* ---------------- coupon apply ---------------- */
  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setCouponBusy(true);
    try {
      const result = await orderApi.validateCoupon({
        code: trimmed,
        restaurantId: cart.restaurantId ?? undefined,
        orderAmount: cart.subTotal,
        appliesTo: 'ORDER',
      });

      setCoupon(result);
      setCouponInput(trimmed);
      toast.success(result.message);
    } catch (err) {
      setCoupon(null);
      toast.error(err instanceof ApiError ? err.detail : 'Could not apply the coupon.');
    } finally {
      setCouponBusy(false);
    }
  };

  /* ---------------- place order + pay ---------------- */
  const placeOrder = async () => {
    setPlaceError(null);

    if (orderType === 'DELIVERY' && !addressId) {
      setPlaceError('Please select a delivery address.');
      return;
    }

    if (orderType === 'DELIVERY' && deliverability && !deliverability.isDeliverable) {
      setPlaceError(
        `This address is ${deliverability.distanceKm} km away and our delivery limit is ${deliverability.deliveryRadiusKm} km. Please choose another address or switch to Pickup.`,
      );
      return;
    }

    setPlacing(true);

    try {
      /* ---- 1. order create ---- */
      const order = await orderApi.place({
        restaurantId: cart.restaurantId!,
        addressId: orderType === 'DELIVERY' ? addressId! : undefined,
        items: cart.lines.map((l) => ({ foodItemId: l.foodItemId, quantity: l.quantity })),
        couponCode: coupon?.isValid ? couponInput : undefined,
        paymentMode,
        orderType,
        customerNote: note.trim() || undefined,
      });

      /* ---- 2. COD: bas ho gaya ---- */
      if (paymentMode === 'COD') {
        cart.clear();
        toast.success(`Order ${order.orderNumber} placed! Pay cash on delivery.`);
        navigate(`/my-orders/${order.orderId}`);
        return;
      }

      /* ---- 3. ONLINE: payment create -> checkout -> verify ---- */
      setStep('paying');

      const intent = await paymentApi.create({ orderId: order.orderId, purposeType: 'ORDER' });

      // Provider ke hisaab se sahi checkout chalta hai - Razorpay popup ya mock
      const checkout = await runCheckout(intent, {
        name: user?.fullName,
        email: user?.email,
        contact: user?.phone ?? undefined,
        description: `Order ${order.orderNumber}`,
      });

      await paymentApi.verify({
        paymentRef: intent.paymentRef,
        gatewayOrderId: checkout.gatewayOrderId,
        gatewayPaymentId: checkout.gatewayPaymentId,
        signature: checkout.signature,
        method: checkout.method,
      });

      cart.clear();
      setStep('done');
      toast.success(`Payment successful! Order ${order.orderNumber} is confirmed.`);
      navigate(`/my-orders/${order.orderId}`);
    } catch (err) {
      setStep('address');

      // User ne khud popup band kiya - order ban chuka hai, sirf payment pending hai
      if (err instanceof CheckoutCancelledError) {
        toast.info('Payment cancelled. The order is pending under "My orders" - you can pay for it from there.');
        cart.clear();
        navigate('/my-orders');
        return;
      }

      const message =
        err instanceof ApiError
          ? err.detail
          : (err as Error)?.message || 'Could not place the order.';

      setPlaceError(message);
      toast.error(message);
    } finally {
      setPlacing(false);
    }
  };

  /* ---------------- empty cart ---------------- */
  if (cart.isEmpty) {
    return (
      <div className="container-app py-16">
        <EmptyState
          title="Your cart is empty"
          description="Add some items first, then come to checkout."
          action={
            <Link to="/restaurants" className="btn-primary">
              Browse restaurants
            </Link>
          }
        />
      </div>
    );
  }

  if (step === 'paying') {
    return <PageLoader label="Processing payment... please do not close this page." />;
  }

  return (
    <div className="container-app py-6">
      <h1 className="mb-1 text-2xl font-bold text-ink-900 sm:text-3xl">Checkout</h1>
      <p className="mb-6 text-sm text-ink-500">
        {cart.itemCount} items from{' '}
        <Link to={`/restaurant/${cart.restaurantSlug}`} className="font-semibold text-brand-700 hover:underline">
          {cart.restaurantName}
        </Link>
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ==================== left column ==================== */}
        <div className="space-y-5">
          {/* ---- order type ---- */}
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Delivery ya pickup?</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { key: 'DELIVERY', title: 'Delivery', text: 'Ghar tak pahunchayenge (15 km tak)' },
                  { key: 'PICKUP', title: 'Pickup', text: 'Khud restaurant se le jaunga' },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOrderType(o.key)}
                  className={`cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                    orderType === o.key
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-ink-200 hover:border-ink-300'
                  }`}
                >
                  <p className="font-semibold text-ink-900">{o.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{o.text}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ---- address ---- */}
          {orderType === 'DELIVERY' && (
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-ink-900">Delivery address</h2>
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="btn-outline btn-sm"
                >
                  + New address
                </button>
              </div>

              {addrLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-20 w-full" />
                  <div className="skeleton h-20 w-full" />
                </div>
              ) : (addresses?.length ?? 0) === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
                  No saved addresses. Click "New address" to add one.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {addresses!.map((a) => (
                    <label
                      key={a.addressId}
                      className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition ${
                        addressId === a.addressId
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-ink-200 hover:border-ink-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={addressId === a.addressId}
                        onChange={() => setAddressId(a.addressId)}
                        className="mt-1 size-4 accent-brand-600"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink-900">{a.label}</span>
                          {a.isDefault && <Badge tone="blue">Default</Badge>}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-600">{a.addressLine}</span>
                        {a.landmark && <span className="block text-xs text-ink-400">{a.landmark}</span>}
                        <span className="block text-xs text-ink-400">
                          {a.city} {a.pincode}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* 15 km check result */}
              {deliverability && (
                <div
                  className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
                    deliverability.isDeliverable
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-brand-200 bg-brand-50 text-brand-800'
                  }`}
                >
                  {deliverability.isDeliverable ? (
                    <>
                      <strong>{deliverability.distanceKm} km door</strong> away - delivery is available.
                      Delivery charge <strong>{currency(deliverability.deliveryFee)}</strong>,
                      approx {deliverability.etaMinutes} min me pahunch jayega.
                    </>
                  ) : (
                    <>
                      Ye address <strong>{deliverability.distanceKm} km</strong> door hai, hamari limit{' '}
                      {deliverability.deliveryRadiusKm} km hai. Doosra address choose karo ya Pickup select karo.
                    </>
                  )}
                </div>
              )}

              {/* delivery charge ki poori rate list */}
              <div className="mt-3">
                <DeliveryRateCard
                  distanceKm={deliverability?.distanceKm}
                  currentFee={deliverability?.deliveryFee}
                />
              </div>
            </section>
          )}

          {/* ---- items ---- */}
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Order summary</h2>

            <ul className="divide-y divide-ink-100">
              {cart.lines.map((l) => (
                <li key={l.foodItemId} className="flex items-center gap-3 py-3">
                  <SafeImage src={l.imageUrl} alt={l.name} className="size-14 shrink-0 rounded-lg object-cover" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <VegMark isVeg={l.isVeg} />
                      <p className="truncate text-sm font-semibold text-ink-900">{l.name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {currency(l.price)} x {l.quantity}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center rounded-lg border border-ink-200">
                    <button
                      type="button"
                      onClick={() => cart.decrement(l.foodItemId)}
                      className="cursor-pointer px-2.5 py-1 text-sm font-bold text-ink-600 hover:bg-ink-50"
                      aria-label="Decrease"
                    >
                      -
                    </button>
                    <span className="min-w-6 text-center text-sm font-bold">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => cart.increment(l.foodItemId)}
                      className="cursor-pointer px-2.5 py-1 text-sm font-bold text-ink-600 hover:bg-ink-50"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>

                  <p className="w-20 shrink-0 text-right text-sm font-bold text-ink-900">
                    {currency(l.price * l.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <label htmlFor="co-note" className="label">
                Note for the restaurant (optional)
              </label>
              <textarea
                id="co-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. make it less spicy, send extra raita"
                className="input resize-y"
              />
            </div>
          </section>

          {/* ---- payment mode ---- */}
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Payment</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { key: 'ONLINE', title: 'Online payment', text: 'UPI / Card / Netbanking' },
                  { key: 'COD', title: 'Cash on delivery', text: 'Delivery par cash do' },
                ] as const
              ).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPaymentMode(p.key)}
                  className={`cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                    paymentMode === p.key
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-ink-200 hover:border-ink-300'
                  }`}
                >
                  <p className="font-semibold text-ink-900">{p.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{p.text}</p>
                </button>
              ))}
            </div>

            {paymentMode === 'ONLINE' && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                <strong>Note:</strong> Payments run through Razorpay. You will be taken to a secure checkout, and
                your order is confirmed only after the payment signature is verified.
              </p>
            )}
          </section>
        </div>

        {/* ==================== right column: bill ==================== */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {/* ---- coupon ---- */}
          <section className="card mb-4 p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Apply a coupon</h2>

            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="COUPON CODE"
                className="input font-mono tracking-wider uppercase"
                maxLength={40}
              />
              <button
                type="button"
                onClick={() => applyCoupon(couponInput)}
                disabled={couponBusy || !couponInput.trim()}
                className="btn-outline shrink-0"
              >
                {couponBusy ? <Spinner className="size-4" /> : 'Apply'}
              </button>
            </div>

            {coupon?.isValid && (
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-green-50 px-3 py-2">
                <p className="text-sm font-semibold text-green-800">
                  {currency(coupon.discountAmount)} bach gaye!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    setCouponInput('');
                  }}
                  className="cursor-pointer text-xs font-semibold text-green-700 hover:underline"
                >
                  Hatao
                </button>
              </div>
            )}

            {(availableCoupons?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">
                  Available coupons
                </p>

                {availableCoupons!.slice(0, 4).map((c) => (
                  <button
                    key={c.couponId}
                    type="button"
                    onClick={() => applyCoupon(c.code)}
                    className="w-full cursor-pointer rounded-lg border border-dashed border-ink-200 px-3 py-2 text-left transition hover:border-brand-400 hover:bg-brand-50"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-brand-700">{c.code}</span>
                      <span className="text-xs font-semibold text-ink-600">
                        {c.discountType === 'PERCENT'
                          ? `${c.discountValue}% off`
                          : `${currency(c.discountValue)} off`}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">{c.title}</span>
                    {c.minOrderAmount > 0 && (
                      <span className="block text-[11px] text-ink-400">
                        Min order {currency(c.minOrderAmount)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ---- bill ---- */}
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Bill details</h2>

            <dl className="space-y-2 text-sm">
              <Row label="Item total" value={currency(bill.subTotal)} />

              {bill.discount > 0 && (
                <Row label="Coupon discount" value={`- ${currency(bill.discount)}`} tone="green" />
              )}

              <Row
                label={
                  orderType === 'PICKUP'
                    ? 'Delivery charge (pickup - not applicable)'
                    : deliverability
                      ? `Delivery charge (${deliverability.distanceKm} km)`
                      : 'Delivery charge'
                }
                value={bill.deliveryFee === 0 ? '--' : currency(bill.deliveryFee)}
              />

              <Row label="Packaging fee" value={currency(bill.packagingFee)} />
              <Row label={`GST (${bill.gstPercent}%)`} value={currency(bill.tax)} />

              <div className="border-t border-ink-100 pt-2.5">
                <Row label="Total payable" value={currency(bill.total)} bold />
              </div>
            </dl>

            {placeError && (
              <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-800">
                {placeError}
              </p>
            )}

            <button
              type="button"
              onClick={placeOrder}
              disabled={
                placing ||
                (orderType === 'DELIVERY' && (!addressId || deliverability?.isDeliverable === false))
              }
              className="btn-primary mt-4 w-full py-3"
            >
              {placing && <Spinner className="size-4" />}
              {paymentMode === 'COD'
                ? `Place order - ${currency(bill.total)}`
                : `Pay ${currency(bill.total)}`}
            </button>

            <p className="mt-2.5 text-center text-xs text-ink-400">
              By placing the order you accept the terms. The final amount is recalculated on the
              server.
            </p>
          </section>
        </aside>
      </div>

      {/* ---- new address modal ---- */}
      <AddressForm
        open={showAddressForm}
        onClose={() => setShowAddressForm(false)}
        onSaved={(newId) => {
          setShowAddressForm(false);
          setAddressId(newId);
          reloadAddresses();
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- */

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
        className={`${bold ? 'text-base font-bold text-ink-900' : 'font-medium'} ${
          tone === 'green' ? 'text-rating-500' : bold ? '' : 'text-ink-800'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
