import { Link } from 'react-router-dom';
import { useLocationCtx } from '@/context/LocationContext';
import { RatingBadge, SafeImage } from './ui';
import type { Restaurant } from '@/types';

/**
 * Zomato listing card:
 * image -> naam + rating badge -> cuisines + cost for two ->
 * locality + distance -> "Closes in N minutes" / "Closed" line.
 */
export default function RestaurantCard({ restaurant: r }: { restaurant: Restaurant }) {
  const { currency } = useLocationCtx();

  const closingSoon = r.isOpenNow && r.minutesToClose !== null && r.minutesToClose !== undefined && r.minutesToClose <= 60;
  const outOfRange = r.isDeliverable === false;

  return (
    <Link
      to={`/restaurant/${r.slug}`}
      className="card-hover group block overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {/* ---------------- image ---------------- */}
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
        <SafeImage
          src={r.thumbnailUrl}
          alt={r.name}
          className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />

        {/* offer ribbon */}
        {r.offerText && (
          <span className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-ink-900/85 to-transparent px-3 pt-6 pb-2 text-xs font-bold text-white">
            {r.offerText}
          </span>
        )}

        {/* top-left flags */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {r.isPromoted && (
            <span className="rounded bg-ink-900/75 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase backdrop-blur">
              Promoted
            </span>
          )}
          {r.isPureVeg && (
            <span className="rounded bg-rating-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
              Pure Veg
            </span>
          )}
        </div>

        {/* closed / out-of-range overlay */}
        {(!r.isOpenNow || outOfRange) && (
          <div className="absolute inset-0 grid place-items-center bg-ink-900/60 backdrop-blur-[1px]">
            <span className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-ink-800">
              {!r.isOpenNow ? 'Currently closed' : `${r.distanceKm} km - delivery range se bahar`}
            </span>
          </div>
        )}
      </div>

      {/* ---------------- body ---------------- */}
      <div className="p-4">
        {/* name + rating */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base leading-snug font-semibold text-ink-900">{r.name}</h3>
          <span className="shrink-0">
            <RatingBadge value={r.rating} />
          </span>
        </div>

        {/* cuisines + cost for two */}
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-ink-500">
            {r.cuisineNames || r.tagline || 'Multi-cuisine'}
          </p>
          <p className="shrink-0 text-sm text-ink-500">{currency(r.costForTwo)} for two</p>
        </div>

        {/* locality + distance */}
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-ink-400">
            {r.locality}, {r.city}
          </p>
          {r.distanceKm !== null && r.distanceKm !== undefined && (
            <p className="shrink-0 text-sm text-ink-400">
              {r.distanceKm < 1 ? `${Math.round(r.distanceKm * 1000)} m` : `${r.distanceKm} km`}
            </p>
          )}
        </div>

        {/* timing / eta strip */}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-ink-100 pt-2">
          {r.isOpenNow ? (
            <span className={`text-xs font-semibold ${closingSoon ? 'text-brand-600' : 'text-rating-500'}`}>
              {closingSoon ? `Closes in ${r.minutesToClose} minutes` : 'Open now'}
            </span>
          ) : (
            <span className="text-xs font-semibold text-ink-400">
              Opens at {r.openingTime?.slice(0, 5)}
            </span>
          )}

          {r.etaMinutes ? (
            <span className="text-xs font-medium text-ink-500">{r.etaMinutes} min</span>
          ) : (
            <span className="text-xs font-medium text-ink-500">{r.avgPrepTimeMin} min prep</span>
          )}
        </div>

        {/* feature chips */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {r.deliveryFee !== null && r.deliveryFee !== undefined && r.deliveryFee > 0 && r.isDeliverable !== false && (
            <Tag tone="green">Delivery {currency(r.deliveryFee)}</Tag>
          )}
          {r.hasTableBooking && <Tag>Table booking</Tag>}
          {r.hasHallBooking && <Tag>Party hall</Tag>}
          {r.hasOutdoorSeating && <Tag>Outdoor</Tag>}
          {r.isPetFriendly && <Tag>Pet friendly</Tag>}
          {r.servesAlcohol && <Tag>Serves alcohol</Tag>}
        </div>
      </div>
    </Link>
  );
}

function Tag({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'green' }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-ink-100 text-ink-500'
      }`}
    >
      {children}
    </span>
  );
}

/* --------------------- compact variant (home rows) -------------------- */

export function RestaurantCardCompact({ restaurant: r }: { restaurant: Restaurant }) {
  const { currency } = useLocationCtx();

  return (
    <Link
      to={`/restaurant/${r.slug}`}
      className="group flex w-64 shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-ink-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
        <SafeImage
          src={r.thumbnailUrl}
          alt={r.name}
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
        {!r.isOpenNow && (
          <div className="absolute inset-0 grid place-items-center bg-ink-900/55">
            <span className="rounded bg-white/95 px-2 py-1 text-[11px] font-bold text-ink-800">Closed</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-ink-900">{r.name}</h3>
          <RatingBadge value={r.rating} size="sm" />
        </div>
        <p className="mt-1 truncate text-xs text-ink-500">{r.cuisineNames || 'Multi-cuisine'}</p>
        <p className="mt-auto pt-2 text-xs text-ink-400">
          {currency(r.costForTwo)} for two
          {r.distanceKm !== null && r.distanceKm !== undefined && ` - ${r.distanceKm} km`}
        </p>
      </div>
    </Link>
  );
}
