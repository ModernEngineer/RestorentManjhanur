import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { hallApi, paymentApi } from '@/api/endpoints';
import { runCheckout } from '@/api/payment';
import { Badge, ErrorBanner, PageLoader, SafeImage, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';
import type { HallQuote } from '@/types';

const EVENT_TYPES = ['Birthday', 'Anniversary', 'Kitty Party', 'Corporate', 'Wedding', 'Other'];
const CAKE_FLAVOURS = ['Chocolate Truffle', 'Black Forest', 'Butterscotch', 'Red Velvet', 'Pineapple', 'Vanilla'];
const TIME_SLOTS = ['11:00', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

function todayIso() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function HallDetail() {
  const { hallId = '' } = useParams();
  const { currency } = useLocationCtx();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  /* ---------------- form state ---------------- */
  const [eventType, setEventType] = useState('Birthday');
  const [eventDate, setEventDate] = useState(() =>
    new Date(Date.now() + 7 * 86400000 + 5.5 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('23:00');
  const [guests, setGuests] = useState(50);
  const [theme, setTheme] = useState('');
  const [cakeRequired, setCakeRequired] = useState(false);
  const [cakeFlavour, setCakeFlavour] = useState(CAKE_FLAVOURS[0]);
  const [cakeWeight, setCakeWeight] = useState(1);
  const [menuPref, setMenuPref] = useState('Both');
  const [request, setRequest] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [quote, setQuote] = useState<HallQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [slotFree, setSlotFree] = useState<boolean | null>(null);
  const [booking, setBooking] = useState(false);

  const { data, isLoading, error, reload } = useAsync(() => hallApi.detail(Number(hallId)), [hallId]);

  usePageTitle(data?.hall.name ?? 'Party hall');

  const hall = data?.hall;

  /* guest count hall ki capacity me clamp karo */
  useEffect(() => {
    if (!hall) return;
    setGuests((g) => Math.min(Math.max(g, hall.minCapacity), hall.maxCapacity));
    setContactName((n) => n);
  }, [hall]);

  /* ---------------- slot availability ---------------- */
  useEffect(() => {
    if (!hall) return;

    let active = true;
    const t = setTimeout(() => {
      hallApi
        .availability({ hallId: hall.hallId, eventDate, startTime, endTime })
        .then((res) => { if (active) setSlotFree(res.isAvailable); })
        .catch(() => { if (active) setSlotFree(null); });
    }, 300);

    return () => { active = false; clearTimeout(t); };
  }, [hall, eventDate, startTime, endTime]);

  /* ---------------- live quote ---------------- */
  useEffect(() => {
    if (!hall || !isAuthenticated) return;

    let active = true;
    const t = setTimeout(() => {
      hallApi
        .quote({
          hallId: hall.hallId,
          guestCount: guests,
          cakeRequired,
          cakeWeightKg: cakeRequired ? cakeWeight : undefined,
          decorationTheme: theme.trim() || undefined,
          couponCode: couponCode.trim().toUpperCase() || undefined,
        })
        .then((q) => {
          if (!active) return;
          setQuote(q);
          setQuoteError(null);
        })
        .catch((err) => {
          if (!active) return;
          setQuote(null);
          setQuoteError(err instanceof ApiError ? err.detail : 'Could not build a quote.');
        });
    }, 400);

    return () => { active = false; clearTimeout(t); };
  }, [hall, isAuthenticated, guests, cakeRequired, cakeWeight, theme, couponCode]);

  const amenities = useMemo<string[]>(() => {
    if (!hall?.amenitiesJson) return [];
    try {
      const parsed = JSON.parse(hall.amenitiesJson);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, [hall?.amenitiesJson]);

  /* ---------------- submit ---------------- */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hall) return;

    if (!isAuthenticated) {
      toast.info('Please log in to book a hall.');
      navigate('/login', { state: { from: `/party-halls/${hallId}` } });
      return;
    }

    setBooking(true);

    try {
      const result = await hallApi.book({
        hallId: hall.hallId,
        eventType,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        eventDate,
        startTime,
        endTime,
        guestCount: guests,
        decorationTheme: theme.trim() || undefined,
        cakeRequired,
        cakeFlavour: cakeRequired ? cakeFlavour : undefined,
        cakeWeightKg: cakeRequired ? cakeWeight : undefined,
        menuPreference: menuPref,
        specialRequest: request.trim() || undefined,
        couponCode: couponCode.trim().toUpperCase() || undefined,
      });

      toast.success(result.message ?? 'Booking requested.');

      /* advance payment turant offer karo */
      try {
        const intent = await paymentApi.create({
          hallBookingId: result.bookingId,
          purposeType: 'HALL',
        });

        const checkout = await runCheckout(intent, {
          name: contactName.trim(),
          email: user?.email,
          contact: contactPhone.trim(),
          description: `${eventType} - ${hall.name}`,
        });

        await paymentApi.verify({
          paymentRef: intent.paymentRef,
          gatewayOrderId: checkout.gatewayOrderId,
          gatewayPaymentId: checkout.gatewayPaymentId,
          signature: checkout.signature,
          method: checkout.method,
        });

        toast.success(`Advance of ${currency(intent.amount)} paid - booking CONFIRMED!`);
      } catch {
        toast.info('The booking was created but the advance was not paid. You can pay from "My bookings".');
      }

      navigate('/my-bookings');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : 'Could not complete the booking.');
    } finally {
      setBooking(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading hall..." />;

  if (error || !hall) {
    return (
      <div className="container-app py-10">
        <ErrorBanner message={error ?? 'Hall not found.'} onRetry={reload} />
        <Link to="/party-halls" className="btn-outline mt-4">
          Browse all halls
        </Link>
      </div>
    );
  }

  const maxDate = new Date(Date.now() + 364 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="container-app py-6">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-ink-400">
        <Link to="/" className="hover:text-ink-700">Home</Link>
        <span>/</span>
        <Link to="/party-halls" className="hover:text-ink-700">Party halls</Link>
        <span>/</span>
        <span className="truncate text-ink-700">{hall.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* ==================== left: hall info ==================== */}
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <SafeImage
              src={hall.imageUrl}
              alt={hall.name}
              loading="eager"
              className="h-56 w-full object-cover sm:h-72"
            />

            <div className="p-5">
              <h1 className="text-2xl font-bold text-ink-900">{hall.name}</h1>

              <p className="mt-1 text-sm text-ink-500">
                {hall.restaurantName} - {hall.addressLine ?? ''} {hall.locality}, {hall.city}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="blue">{hall.minCapacity}-{hall.maxCapacity} guests</Badge>
                {hall.hasAC && <Badge tone="green">AC</Badge>}
                {hall.hasDJ && <Badge tone="purple">DJ available</Badge>}
                {hall.hasParking && <Badge>Parking</Badge>}
                {amenities.map((a) => (
                  <Badge key={a}>{a}</Badge>
                ))}
              </div>

              {hall.description && (
                <p className="mt-4 text-sm leading-relaxed text-ink-600">{hall.description}</p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PriceTile label="Per plate" value={currency(hall.pricePerPlate)} />
                <PriceTile label="Hall rent" value={currency(hall.baseRent)} />
                <PriceTile label="Advance" value="30%" />
              </div>

              {hall.restaurantPhone && (
                <a href={`tel:${hall.restaurantPhone}`} className="btn-outline mt-4">
                  Restaurant ko call karo: {hall.restaurantPhone}
                </a>
              )}
            </div>
          </div>

          {/* ---- busy dates ---- */}
          {(data?.busySlots.length ?? 0) > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold text-ink-900">These slots are already booked</h2>

              <ul className="space-y-2">
                {data!.busySlots.map((s, i) => (
                  <li
                    key={`${s.eventDate}-${s.startTime}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink-50 px-3.5 py-2.5 text-sm"
                  >
                    <span className="font-medium text-ink-800">
                      {new Date(s.eventDate).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-ink-500">
                      {s.startTime?.slice(0, 5)} - {s.endTime?.slice(0, 5)}
                    </span>
                    <Badge tone="amber">{s.eventType}</Badge>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs text-ink-400">
                As soon as you pick a date and time in the booking form we will tell you if the slot is free.
              </p>
            </section>
          )}
        </div>

        {/* ==================== right: booking form ==================== */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <form onSubmit={submit} className="card space-y-4 p-5">
            <h2 className="text-base font-semibold text-ink-900">Book hall</h2>

            {/* event type */}
            <div>
              <span className="label">What is the occasion?</span>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEventType(t)}
                    className={`chip ${eventType === t ? 'chip-active' : ''}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* date + time */}
            <div>
              <label htmlFor="hd-date" className="label">Event date</label>
              <input
                id="hd-date"
                type="date"
                value={eventDate}
                min={todayIso()}
                max={maxDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="hd-start" className="label">Start</label>
                <select
                  id="hd-start"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="select"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="hd-end" className="label">End</label>
                <select
                  id="hd-end"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="select"
                >
                  {TIME_SLOTS.filter((t) => t > startTime).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* slot status */}
            {slotFree !== null && (
              <p
                className={`rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                  slotFree ? 'bg-green-50 text-green-800' : 'bg-brand-50 text-brand-800'
                }`}
              >
                {slotFree
                  ? 'This slot is free - go ahead and book.'
                  : 'The hall is already booked for this slot. Choose another time.'}
              </p>
            )}

            {/* guests */}
            <div>
              <label htmlFor="hd-guests" className="label">
                Kitne guests? ({hall.minCapacity} se {hall.maxCapacity})
              </label>
              <input
                id="hd-guests"
                type="number"
                value={guests}
                min={hall.minCapacity}
                max={hall.maxCapacity}
                onChange={(e) => setGuests(Number(e.target.value))}
                required
                className="input"
              />
              <input
                type="range"
                value={guests}
                min={hall.minCapacity}
                max={hall.maxCapacity}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="mt-2 w-full accent-brand-600"
                aria-label="Guest count slider"
              />
            </div>

            {/* decoration */}
            <div>
              <label htmlFor="hd-theme" className="label">Decoration theme (optional)</label>
              <input
                id="hd-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={120}
                placeholder="e.g. balloon + flower birthday decor"
                className="input"
              />
              <p className="mt-1 text-xs text-ink-400">
                Decoration add karne par {currency(2500)} charge lagta hai.
              </p>
            </div>

            {/* cake */}
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-3.5">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={cakeRequired}
                  onChange={(e) => setCakeRequired(e.target.checked)}
                  className="size-4 accent-brand-600"
                />
                <span className="text-sm font-semibold text-ink-800">I also want a cake</span>
              </label>

              {cakeRequired && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="hd-flavour" className="label">Flavour</label>
                    <select
                      id="hd-flavour"
                      value={cakeFlavour}
                      onChange={(e) => setCakeFlavour(e.target.value)}
                      className="select"
                    >
                      {CAKE_FLAVOURS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="hd-weight" className="label">Weight (kg)</label>
                    <select
                      id="hd-weight"
                      value={cakeWeight}
                      onChange={(e) => setCakeWeight(Number(e.target.value))}
                      className="select"
                    >
                      {[0.5, 1, 1.5, 2, 3, 4, 5].map((w) => (
                        <option key={w} value={w}>{w} kg</option>
                      ))}
                    </select>
                  </div>

                  <p className="col-span-2 text-xs text-ink-500">
                    Cake {currency(800)} per kg - total {currency(800 * cakeWeight)}
                  </p>
                </div>
              )}
            </div>

            {/* menu pref */}
            <div>
              <span className="label">Menu preference</span>
              <div className="flex gap-2">
                {['Veg', 'Non-Veg', 'Both'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMenuPref(m)}
                    className={`chip ${menuPref === m ? 'chip-active' : ''}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* contact */}
            <div>
              <label htmlFor="hd-name" className="label">Contact person</label>
              <input
                id="hd-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="hd-phone" className="label">Phone number</label>
              <input
                id="hd-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                pattern="[0-9+\-\s()]{7,20}"
                placeholder="9810000000"
                className="input"
              />
            </div>

            {/* special request */}
            <div>
              <label htmlFor="hd-req" className="label">Special request (optional)</label>
              <textarea
                id="hd-req"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="e.g. cake table near the stage, DJ from 21:00, projector needed"
                className="input resize-y"
              />
            </div>

            {/* coupon */}
            <div>
              <label htmlFor="hd-coupon" className="label">Coupon code (optional)</label>
              <input
                id="hd-coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                maxLength={40}
                placeholder="PARTY15 / BDAYSPECIAL"
                className="input font-mono tracking-wider uppercase"
              />
            </div>

            {/* ---------------- quote ---------------- */}
            {!isAuthenticated ? (
              <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                Log in to see the price estimate and to book.
              </p>
            ) : quoteError ? (
              <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-800">
                {quoteError}
              </p>
            ) : quote?.isValid ? (
              <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
                <p className="mb-2 text-sm font-semibold text-ink-900">Estimate</p>

                <dl className="space-y-1.5 text-sm">
                  <QRow label="Hall rent" value={currency(quote.baseRent)} />
                  <QRow
                    label={`Plates (${quote.guestCount} x ${currency(quote.pricePerPlate)})`}
                    value={currency(quote.plateAmount)}
                  />
                  {quote.decorationCharge > 0 && (
                    <QRow label="Decoration + cake" value={currency(quote.decorationCharge)} />
                  )}
                  {quote.discountAmount > 0 && (
                    <QRow label="Coupon discount" value={`- ${currency(quote.discountAmount)}`} tone="green" />
                  )}
                  <QRow label="GST (18%)" value={currency(quote.taxAmount)} />

                  <div className="border-t border-ink-200 pt-1.5">
                    <QRow label="Total" value={currency(quote.totalAmount)} bold />
                  </div>

                  <QRow label="Payable now (30%)" value={currency(quote.advancePayable)} tone="brand" />
                </dl>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <Spinner className="size-4" /> Preparing your estimate...
              </div>
            )}

            <button
              type="submit"
              disabled={booking || slotFree === false || (isAuthenticated && !quote?.isValid)}
              className="btn-primary w-full py-3"
            >
              {booking && <Spinner className="size-4" />}
              {quote?.isValid
                ? `Book now - advance ${currency(quote.advancePayable)}`
                : 'Book hall'}
            </button>

            <p className="text-center text-xs text-ink-400">
              Paying the 30% advance marks the booking CONFIRMED. The rest is due on the event day.
            </p>
          </form>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- */

function PriceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-3.5 py-3 text-center">
      <p className="text-lg font-bold text-ink-900">{value}</p>
      <p className="text-[11px] tracking-wide text-ink-500 uppercase">{label}</p>
    </div>
  );
}

function QRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'brand';
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={bold ? 'font-bold text-ink-900' : 'text-ink-600'}>{label}</dt>
      <dd
        className={`font-medium ${bold ? 'text-base font-bold text-ink-900' : ''} ${
          tone === 'green' ? 'text-rating-500' : tone === 'brand' ? 'font-bold text-brand-700' : 'text-ink-800'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
