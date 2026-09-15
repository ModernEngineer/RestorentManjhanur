import { Link } from 'react-router-dom';
import { homeApi } from '@/api/endpoints';
import CornerPromo from '@/components/CornerPromo';
import HeroVideoSlider from '@/components/HeroVideoSlider';
import { RestaurantCardCompact } from '@/components/RestaurantCard';
import Testimonials from '@/components/Testimonials';
import { CardGridSkeleton, ErrorBanner, SafeImage, SectionHeading } from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

export default function Home() {
  usePageTitle('Order food online, book tables & party halls');

  const { location, currency } = useLocationCtx();

  const { data, isLoading, error, reload } = useAsync(
    () =>
      homeApi.feed({
        city: location.city,
        lat: location.lat ?? undefined,
        lng: location.lng ?? undefined,
      }),
    [location.city, location.lat, location.lng],
  );

  return (
    <>
      {/* ==================== HERO VIDEO SLIDER ==================== */}
      <HeroVideoSlider />

      {/* corner promo - scroll karne par bottom-left me aata hai */}
      <CornerPromo />

      <div id="home-sections" className="scroll-mt-16">
        {/* ==================== quick actions ==================== */}
        <section className="border-b border-ink-100 bg-white py-8">
          <div className="container-app grid gap-4 sm:grid-cols-3">
            <ActionCard
              to="/restaurants"
              title="Order online"
              text="Order food from home - delivery up to 15 km"
              accent="bg-brand-50 text-brand-600"
              icon="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13 5.4 5M7 13l-2 5h14"
            />
            <ActionCard
              to="/dining"
              title="Dining out"
              text="Book a table in advance, no waiting"
              accent="bg-blue-50 text-blue-600"
              icon="M8 2v4m8-4v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            />
            <ActionCard
              to="/party-halls"
              title="Party halls"
              text="Birthday, anniversary aur corporate events"
              accent="bg-purple-50 text-purple-600"
              icon="M12 2 9 9H2l5.5 4.5L5 21l7-4.5L19 21l-2.5-7.5L22 9h-7z"
            />
          </div>
        </section>

        {error && (
          <div className="container-app py-10">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        )}

        {/* ==================== cuisines ==================== */}
        {!error && (
          <section className="py-12">
            <div className="container-app">
              <SectionHeading
                title="What are you craving?"
                subtitle="Pick a cuisine and we will show you the restaurants"
              />

              {isLoading ? (
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="shrink-0 space-y-2">
                      <div className="skeleton size-20 rounded-full" />
                      <div className="skeleton mx-auto h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar sm:gap-6">
                  {(data?.cuisines ?? []).map((c) => (
                    <Link
                      key={c.cuisineId}
                      to={`/restaurants?cuisineIds=${c.cuisineId}&city=${encodeURIComponent(location.city)}`}
                      className="group flex w-20 shrink-0 flex-col items-center gap-2 text-center sm:w-24"
                    >
                      <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-brand-50 to-amber-50 text-xl font-bold text-brand-700 ring-1 ring-ink-100 transition group-hover:scale-105 group-hover:ring-brand-300 sm:size-24">
                        {c.name.slice(0, 2)}
                      </span>
                      <span className="text-xs font-semibold text-ink-700 group-hover:text-brand-700">
                        {c.name}
                      </span>
                      {c.restaurantCount ? (
                        <span className="-mt-1.5 text-[10px] text-ink-400">{c.restaurantCount} places</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ==================== live offers ==================== */}
        {!isLoading && (data?.offers?.length ?? 0) > 0 && (
          <section className="bg-white py-12">
            <div className="container-app">
              <SectionHeading
                title="Aaj ke offers"
                subtitle="Apply the code at checkout and save"
                action={
                  <Link to="/offers" className="btn-outline btn-sm">
                    All offers
                  </Link>
                }
              />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data!.offers.slice(0, 4).map((o) => (
                  <div
                    key={o.couponId}
                    className="relative overflow-hidden rounded-[var(--radius-card)] border border-dashed border-brand-300 bg-gradient-to-br from-brand-50 to-white p-4"
                  >
                    <p className="text-lg font-extrabold text-brand-700">
                      {o.discountType === 'PERCENT'
                        ? `${o.discountValue}% OFF`
                        : `${currency(o.discountValue)} OFF`}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-ink-800">{o.title}</p>

                    {o.minOrderAmount > 0 && (
                      <p className="mt-1 text-xs text-ink-500">
                        Minimum order {currency(o.minOrderAmount)}
                      </p>
                    )}

                    {o.restaurantName && (
                      <p className="mt-1 truncate text-xs text-ink-400">Sirf {o.restaurantName} par</p>
                    )}

                    <p className="mt-3 inline-block rounded-md border border-brand-300 bg-white px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-brand-700">
                      {o.code}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== nearby ==================== */}
        <section className="py-12">
          <div className="container-app">
            <SectionHeading
              title={location.lat ? 'Near you' : 'Popular restaurants'}
              subtitle={
                location.lat
                  ? `Near ${location.label} - sorted by distance`
                  : 'Turn on location and we will show distances too'
              }
              action={
                <Link to="/restaurants" className="btn-outline btn-sm">
                  View all
                </Link>
              }
            />

            {isLoading ? (
              <CardGridSkeleton count={3} />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
                {(data?.nearby ?? []).map((r) => (
                  <RestaurantCardCompact key={r.restaurantId} restaurant={r} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ==================== top rated ==================== */}
        <section className="bg-white py-12">
          <div className="container-app">
            <SectionHeading
              title="Top rated restaurants"
              subtitle="The highest rated - according to customers"
              action={
                <Link to="/restaurants?sortBy=rating" className="btn-outline btn-sm">
                  View all
                </Link>
              }
            />

            {isLoading ? (
              <CardGridSkeleton count={3} />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
                {(data?.topRated ?? []).map((r) => (
                  <RestaurantCardCompact key={r.restaurantId} restaurant={r} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ==================== party hall CTA ==================== */}
        <section className="py-12">
          <div className="container-app">
            <div className="relative overflow-hidden rounded-2xl bg-ink-900">
              <SafeImage
                src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1600&q=80&auto=format&fit=crop"
                alt=""
                className="absolute inset-0 size-full object-cover opacity-45"
              />

              <div className="relative grid gap-6 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="badge bg-white/15 text-white ring-1 ring-white/25">
                    Birthday - Anniversary - Corporate
                  </span>

                  <h2 className="mt-3 text-2xl leading-tight font-bold text-white sm:text-3xl">
                    Book a party hall and leave the rest to us
                  </h2>

                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/85">
                    Halls for 20 to 250 guests. Decoration, cake, DJ and menu - all in one booking.
                    Pay 30% in advance, the rest on the event day.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/party-halls" className="btn-primary">
                      Browse halls
                    </Link>
                    <Link
                      to="/offers"
                      className="btn bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25"
                    >
                      Party offers
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Halls available', value: '16+' },
                    { label: 'Guests tak', value: '250' },
                    { label: 'Advance', value: '30%' },
                    { label: 'Cities', value: '4' },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl bg-white/10 px-4 py-4 text-center ring-1 ring-white/20 backdrop-blur"
                    >
                      <p className="text-2xl font-extrabold text-white">{s.value}</p>
                      <p className="mt-0.5 text-[11px] tracking-wide text-white/75 uppercase">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== happy customers ==================== */}
        {!isLoading && (
          <Testimonials testimonials={data?.testimonials ?? []} counters={data?.counters ?? null} />
        )}

        {/* ==================== cities ==================== */}
        {!isLoading && (data?.cities?.length ?? 0) > 0 && (
          <section className="py-12">
            <div className="container-app">
              <SectionHeading title="Where we deliver" />

              <div className="flex flex-wrap gap-2">
                {data!.cities.map((c) => (
                  <Link
                    key={c.city}
                    to={`/restaurants?city=${encodeURIComponent(c.city)}`}
                    className="chip"
                  >
                    {c.city}
                    <span className="text-ink-400">({c.restaurantCount})</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- */

function ActionCard({
  to,
  title,
  text,
  icon,
  accent,
}: {
  to: string;
  title: string;
  text: string;
  icon: string;
  accent: string;
}) {
  return (
    <Link to={to} className="card-hover flex items-center gap-4 p-5">
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${accent}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6">
          <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <span className="min-w-0">
        <span className="block font-semibold text-ink-900">{title}</span>
        <span className="block text-sm text-ink-500">{text}</span>
      </span>

      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto size-5 shrink-0 text-ink-300">
        <path d="m9 18 6-6-6-6" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
