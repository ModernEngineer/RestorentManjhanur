import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { restaurantApi } from '@/api/endpoints';
import FoodItemCard from '@/components/FoodItemCard';
import ReviewSection from '@/components/ReviewSection';
import TableBookingForm from '@/components/TableBookingForm';
import {
  Badge, EmptyState, ErrorBanner, PageLoader, RatingBadge, SafeImage, VegMark,
} from '@/components/ui';
import { useCart } from '@/context/CartContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

type Tab = 'menu' | 'reviews' | 'info';

export default function RestaurantDetail() {
  const { slug = '' } = useParams();
  const { location, currency } = useLocationCtx();
  const cart = useCart();

  const [tab, setTab] = useState<Tab>('menu');
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [showBooking, setShowBooking] = useState(false);

  const { data, isLoading, error, reload } = useAsync(
    () =>
      restaurantApi.bySlug(slug, {
        lat: location.lat ?? undefined,
        lng: location.lng ?? undefined,
      }),
    [slug, location.lat, location.lng],
  );

  usePageTitle(data?.restaurant.name ?? 'Restaurant');

  /* ---------- menu filtering ---------- */
  const visibleMenu = useMemo(() => {
    const menu = data?.menu ?? [];
    const q = menuSearch.trim().toLowerCase();

    return menu.filter((item) => {
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false;
      if (vegFilter === 'veg' && !item.isVeg) return false;
      if (vegFilter === 'nonveg' && item.isVeg) return false;
      if (q && !item.name.toLowerCase().includes(q) && !(item.description ?? '').toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [data?.menu, activeCategory, vegFilter, menuSearch]);

  /* ---------- grouping by category ---------- */
  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleMenu>();
    for (const item of visibleMenu) {
      const key = item.categoryName ?? 'Other';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visibleMenu]);

  if (isLoading) return <PageLoader label="Loading restaurant..." />;

  if (error || !data) {
    return (
      <div className="container-app py-10">
        <ErrorBanner message={error ?? 'Restaurant not found.'} onRetry={reload} />
        <Link to="/restaurants" className="btn-outline mt-4">
          Browse all restaurants
        </Link>
      </div>
    );
  }

  const r = data.restaurant;
  const canOrder = r.isOpenNow && r.acceptsOnlineOrder && r.isDeliverable !== false;

  const disabledReason = !r.isOpenNow
    ? 'The restaurant is closed right now.'
    : !r.acceptsOnlineOrder
      ? 'This restaurant is not taking online orders right now.'
      : r.isDeliverable === false
        ? `Your address is ${r.distanceKm} km away, outside the delivery range (${r.deliveryRadiusKm} km).`
        : undefined;

  return (
    <>
      {/* ==================== cover ==================== */}
      <div className="relative h-56 w-full overflow-hidden bg-ink-200 sm:h-72">
        <SafeImage
          src={r.coverImageUrl ?? r.thumbnailUrl}
          alt={r.name}
          loading="eager"
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/75 to-ink-900/10" />

        <div className="container-app absolute inset-x-0 bottom-0 pb-5">
          <nav className="mb-2 flex items-center gap-1.5 text-xs text-white/75">
            <Link to="/" className="hover:text-white">Home</Link>
            <span>/</span>
            <Link to="/restaurants" className="hover:text-white">Restaurants</Link>
            <span>/</span>
            <span className="truncate text-white">{r.name}</span>
          </nav>

          <h1 className="text-2xl font-bold text-white drop-shadow sm:text-4xl">{r.name}</h1>
          {r.tagline && <p className="mt-1 text-sm text-white/85">{r.tagline}</p>}
        </div>
      </div>

      {/* ==================== info strip ==================== */}
      <div className="border-b border-ink-100 bg-white">
        <div className="container-app py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <RatingBadge value={r.rating} reviews={r.totalReviews} />

                {r.isOpenNow ? (
                  <Badge tone="green">
                    Open now
                    {r.minutesToClose !== null && r.minutesToClose !== undefined && r.minutesToClose <= 60
                      ? ` - closes in ${r.minutesToClose} min`
                      : ''}
                  </Badge>
                ) : (
                  <Badge tone="red">Currently closed - opens {r.openingTime?.slice(0, 5)}</Badge>
                )}

                {r.isPureVeg && <Badge tone="green">Pure veg</Badge>}
              </div>

              <p className="mt-2 text-sm text-ink-600">
                {data.cuisines.map((c) => c.name).join(', ') || 'Multi-cuisine'}
              </p>

              <p className="mt-1 text-sm text-ink-500">
                {r.addressLine}, {r.locality}, {r.city}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
                <span>{currency(r.costForTwo)} for two</span>
                <span>{r.openingTime?.slice(0, 5)} - {r.closingTime?.slice(0, 5)}</span>

                {r.distanceKm !== null && r.distanceKm !== undefined && (
                  <span className={r.isDeliverable === false ? 'font-semibold text-brand-600' : ''}>
                    {r.distanceKm} km away
                  </span>
                )}

                {r.etaMinutes ? <span>{r.etaMinutes} min delivery</span> : null}

                {r.deliveryFee !== null && r.deliveryFee !== undefined && r.deliveryFee > 0 && (
                  <span>{currency(r.deliveryFee)} delivery charge</span>
                )}
              </div>
            </div>

            {/* actions */}
            <div className="flex flex-wrap gap-2">
              {r.hasTableBooking && (
                <button type="button" onClick={() => setShowBooking(true)} className="btn-outline">
                  Book a table
                </button>
              )}

              {r.hasHallBooking && data.halls.length > 0 && (
                <Link to={`/party-halls?restaurantId=${r.restaurantId}`} className="btn-outline">
                  Party hall
                </Link>
              )}

              {r.phone && (
                <a href={`tel:${r.phone}`} className="btn-outline">
                  Call
                </a>
              )}
            </div>
          </div>

          {/* delivery range warning */}
          {r.isDeliverable === false && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">
                Ye restaurant aapke address se {r.distanceKm} km door hai
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                Hamari delivery limit {r.deliveryRadiusKm} km hai. Aap yahan se pickup kar sakte ho,
                ya navbar se apni location badal kar dekho.
              </p>
            </div>
          )}

          {/* offers */}
          {data.offers.length > 0 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {data.offers.map((o) => (
                <div
                  key={o.couponId}
                  className="shrink-0 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-2.5"
                >
                  <p className="text-sm font-bold text-brand-700">
                    {o.discountType === 'PERCENT'
                      ? `${o.discountValue}% OFF`
                      : `${currency(o.discountValue)} OFF`}
                    {o.maxDiscountAmount ? ` up to ${currency(o.maxDiscountAmount)}` : ''}
                  </p>
                  <p className="text-xs text-ink-600">
                    Code <span className="font-mono font-bold">{o.code}</span>
                    {o.minOrderAmount > 0 && ` - min ${currency(o.minOrderAmount)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================== tabs + booking actions ====================
           Booking buttons yahin sticky bar me hain, taaki menu scroll karte
           waqt bhi hamesha saamne rahein (upar wala info strip scroll ho
           jaata hai).
           ============================================================== */}
      <div className="sticky top-16 z-30 border-b border-ink-100 bg-white">
        <div className="container-app flex items-center justify-between gap-3">
          {/* ---- tabs ---- */}
          <div className="flex gap-1">
            {(
              [
                { key: 'menu', label: `Menu (${data.menu.length})` },
                { key: 'reviews', label: `Reviews (${r.totalReviews})` },
                { key: 'info', label: 'Info' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`cursor-pointer border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap transition sm:px-4 ${
                  tab === t.key
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-ink-500 hover:text-ink-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ---- booking actions ---- */}
          {(r.hasTableBooking || (r.hasHallBooking && data.halls.length > 0)) && (
            <div className="flex shrink-0 items-center gap-2 py-2">
              {r.hasTableBooking && (
                <button
                  type="button"
                  onClick={() => setShowBooking(true)}
                  className="btn-primary btn-sm sm:!px-4 sm:!py-2 sm:!text-sm"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
                    <path d="M8 2v4m8-4v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" strokeLinecap="round" />
                  </svg>
                  <span className="hidden sm:inline">Book a table</span>
                  <span className="sm:hidden">Book</span>
                </button>
              )}

              {r.hasHallBooking && data.halls.length > 0 && (
                <Link
                  to={`/party-halls?restaurantId=${r.restaurantId}`}
                  className="btn-outline btn-sm sm:!px-4 sm:!py-2 sm:!text-sm"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
                    <path d="M12 2 9 9H2l5.5 4.5L5 21l7-4.5L19 21l-2.5-7.5L22 9h-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="hidden sm:inline">Party hall</span>
                  <span className="sm:hidden">Hall</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== content ==================== */}
      <div className="container-app py-6">
        {tab === 'menu' && (
          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            {/* ---- category sidebar ---- */}
            <aside className="lg:sticky lg:top-32 lg:self-start">
              <div className="mb-4 space-y-3">
                <input
                  type="search"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search the menu"
                  className="input"
                  aria-label="Menu search"
                />

                <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
                  {(
                    [
                      { key: 'all', label: 'All' },
                      { key: 'veg', label: 'Veg' },
                      { key: 'nonveg', label: 'Non-veg' },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setVegFilter(v.key)}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                        vegFilter === v.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'
                      }`}
                    >
                      {v.key !== 'all' && <VegMark isVeg={v.key === 'veg'} />}
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <nav className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    activeCategory === 'all' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  Poora menu ({data.menu.length})
                </button>

                {data.categories.map((c) => (
                  <button
                    key={c.categoryId}
                    type="button"
                    onClick={() => setActiveCategory(c.categoryId)}
                    className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      activeCategory === c.categoryId
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-600 hover:bg-ink-100'
                    }`}
                  >
                    {c.name} ({c.itemCount})
                  </button>
                ))}
              </nav>
            </aside>

            {/* ---- items ---- */}
            <div>
              {!canOrder && disabledReason && (
                <p className="mb-4 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm font-medium text-ink-600">
                  {disabledReason} Menu dekh sakte ho, par order abhi place nahi hoga.
                </p>
              )}

              {visibleMenu.length === 0 ? (
                <EmptyState
                  title="Nothing matches this filter"
                  description="Try changing the veg/non-veg filter or the search text."
                />
              ) : (
                grouped.map(([category, items]) => (
                  <section key={category} className="mb-8">
                    <h2 className="mb-1 text-lg font-bold text-ink-900">
                      {category}
                      <span className="ml-2 text-sm font-normal text-ink-400">({items.length})</span>
                    </h2>

                    <div className="card px-5">
                      {items.map((item) => (
                        <FoodItemCard
                          key={item.foodItemId}
                          item={item}
                          restaurant={{ id: r.restaurantId, name: r.name, slug: r.slug }}
                          disabled={!canOrder}
                          disabledReason={disabledReason}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <div className="mx-auto max-w-3xl">
            <ReviewSection
              restaurantId={r.restaurantId}
              restaurantName={r.name}
              rating={r.rating}
              totalReviews={r.totalReviews}
              reviews={data.reviews}
              breakdown={data.ratingBreakdown}
              onReviewAdded={reload}
            />
          </div>
        )}

        {tab === 'info' && (
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            <InfoCard title="Address">
              <p>{r.addressLine}</p>
              <p>
                {r.locality}, {r.city} {r.pincode}
              </p>
              {r.phone && (
                <a href={`tel:${r.phone}`} className="mt-2 inline-block font-semibold text-brand-700">
                  {r.phone}
                </a>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 block text-sm font-semibold text-brand-700 hover:underline"
              >
                View on Google Maps
              </a>
            </InfoCard>

            <InfoCard title="Timing">
              <p>
                Roz {r.openingTime?.slice(0, 5)} se {r.closingTime?.slice(0, 5)} tak
              </p>
              <p className="mt-1 text-ink-500">Average prep time: {r.avgPrepTimeMin} min</p>
              <p className="mt-1 text-ink-500">Delivery radius: {r.deliveryRadiusKm} km</p>
            </InfoCard>

            <InfoCard title="Features">
              <ul className="space-y-1">
                <Feature ok={r.acceptsOnlineOrder} label="Online order" />
                <Feature ok={r.hasTableBooking} label="Table booking" />
                <Feature ok={r.hasHallBooking} label="Party hall booking" />
                <Feature ok={r.hasOutdoorSeating} label="Outdoor seating" />
                <Feature ok={r.isPetFriendly} label="Pet friendly" />
                <Feature ok={r.servesAlcohol} label="Serves alcohol" />
                <Feature ok={r.isPureVeg} label="Pure veg" />
              </ul>
            </InfoCard>

            {r.description && <InfoCard title="Restaurant ke baare me">{r.description}</InfoCard>}

            {data.halls.length > 0 && (
              <div className="sm:col-span-2">
                <h3 className="mb-3 text-lg font-bold text-ink-900">Party halls here</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  {data.halls.map((h) => (
                    <Link key={h.hallId} to={`/party-halls/${h.hallId}`} className="card-hover overflow-hidden">
                      <SafeImage src={h.imageUrl} alt={h.name} className="h-32 w-full object-cover" />
                      <div className="p-3">
                        <p className="truncate font-semibold text-ink-900">{h.name}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {h.minCapacity}-{h.maxCapacity} guests - {currency(h.pricePerPlate)}/plate
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== floating cart bar ==================== */}
      {!cart.isEmpty && cart.restaurantId === r.restaurantId && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white px-4 py-3 shadow-pop sm:px-6">
          <div className="container-app flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">
                {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} - {currency(cart.subTotal)}
              </p>
              <p className="truncate text-xs text-ink-500">Taxes aur delivery checkout par</p>
            </div>

            <Link to="/checkout" className="btn-primary shrink-0">
              Checkout
            </Link>
          </div>
        </div>
      )}

      {/* ==================== table booking ==================== */}
      {showBooking && (
        <TableBookingForm
          open={showBooking}
          onClose={() => setShowBooking(false)}
          restaurant={{ id: r.restaurantId, name: r.name, hasOutdoor: r.hasOutdoorSeating }}
        />
      )}
    </>
  );
}

/* --------------------------------------------------------------- */

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-2 text-sm font-bold tracking-wide text-ink-500 uppercase">{title}</h3>
      <div className="text-sm leading-relaxed text-ink-700">{children}</div>
    </div>
  );
}

function Feature({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-ink-700' : 'text-ink-300'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4 shrink-0">
        {ok ? (
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
        )}
      </svg>
      {label}
    </li>
  );
}
