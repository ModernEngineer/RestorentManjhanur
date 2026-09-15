import { useState } from 'react';
import { restaurantApi } from '@/api/endpoints';
import { useAsync } from '@/hooks/useAsync';
import { Modal } from './ui';
import type { RestaurantFilters } from '@/types';

/* ============================================================
   Zomato jaisi filter chips row:
   Filters | Offers | Rating 4.5+ | Pet friendly | Outdoor seating |
   Serves Alcohol | Open Now   (+ sort dropdown)
   ============================================================ */

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Rating: high to low' },
  { value: 'distance', label: 'Distance: near to far' },
  { value: 'cost_low', label: 'Cost: low to high' },
  { value: 'cost_high', label: 'Cost: high to low' },
  { value: 'popular', label: 'Most reviewed' },
  { value: 'newest', label: 'Newly added' },
];

interface Props {
  filters: RestaurantFilters;
  onChange: (patch: Partial<RestaurantFilters>) => void;
  onReset: () => void;
  resultCount?: number;
}

export default function FilterBar({ filters, onChange, onReset, resultCount }: Props) {
  const [showAll, setShowAll] = useState(false);

  const { data: cuisines } = useAsync(() => restaurantApi.cuisines(), []);
  const { data: localities } = useAsync(() => restaurantApi.localities(filters.city), [filters.city]);

  const selectedCuisines = (filters.cuisineIds ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number);

  const toggleCuisine = (id: number) => {
    const next = selectedCuisines.includes(id)
      ? selectedCuisines.filter((c) => c !== id)
      : [...selectedCuisines, id];

    onChange({ cuisineIds: next.join(','), pageNumber: 1 });
  };

  const activeCount = [
    filters.hasOffers,
    filters.minRating !== undefined,
    filters.petFriendly,
    filters.outdoorSeating,
    filters.servesAlcohol,
    filters.openNow,
    filters.pureVegOnly,
    filters.hasTableBooking,
    filters.hasHallBooking,
    filters.onlyDeliverable,
    filters.maxCostForTwo !== undefined,
    filters.locality !== undefined && filters.locality !== '',
    selectedCuisines.length > 0,
  ].filter(Boolean).length;

  return (
    <>
      <div className="sticky top-16 z-30 -mx-4 border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {/* ---- all filters ---- */}
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`chip ${activeCount > 0 ? 'chip-active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
            </svg>
            Filters
            {activeCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>

          <span className="h-6 w-px shrink-0 bg-ink-200" aria-hidden="true" />

          {/* ---- quick toggles (screenshot wale) ---- */}
          <Chip
            active={!!filters.hasOffers}
            onClick={() => onChange({ hasOffers: !filters.hasOffers, pageNumber: 1 })}
          >
            Offers
          </Chip>

          <Chip
            active={filters.minRating === 4.5}
            onClick={() => onChange({ minRating: filters.minRating === 4.5 ? undefined : 4.5, pageNumber: 1 })}
          >
            Rating: 4.5+
          </Chip>

          <Chip
            active={!!filters.petFriendly}
            onClick={() => onChange({ petFriendly: !filters.petFriendly, pageNumber: 1 })}
          >
            Pet friendly
          </Chip>

          <Chip
            active={!!filters.outdoorSeating}
            onClick={() => onChange({ outdoorSeating: !filters.outdoorSeating, pageNumber: 1 })}
          >
            Outdoor seating
          </Chip>

          <Chip
            active={!!filters.servesAlcohol}
            onClick={() => onChange({ servesAlcohol: !filters.servesAlcohol, pageNumber: 1 })}
          >
            Serves Alcohol
          </Chip>

          <Chip
            active={!!filters.openNow}
            onClick={() => onChange({ openNow: !filters.openNow, pageNumber: 1 })}
          >
            Open Now
          </Chip>

          <Chip
            active={!!filters.pureVegOnly}
            onClick={() => onChange({ pureVegOnly: !filters.pureVegOnly, pageNumber: 1 })}
          >
            Pure Veg
          </Chip>

          <Chip
            active={!!filters.onlyDeliverable}
            onClick={() => onChange({ onlyDeliverable: !filters.onlyDeliverable, pageNumber: 1 })}
            title="Only restaurants that deliver to your address (within 15 km)"
          >
            Delivers to me
          </Chip>

          <span className="h-6 w-px shrink-0 bg-ink-200" aria-hidden="true" />

          {/* ---- sort ---- */}
          <select
            value={filters.sortBy ?? 'relevance'}
            onChange={(e) => onChange({ sortBy: e.target.value, pageNumber: 1 })}
            className="select w-auto shrink-0 !py-2 text-sm"
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {activeCount > 0 && (
            <button type="button" onClick={onReset} className="btn-ghost btn-sm shrink-0 whitespace-nowrap">
              Clear all
            </button>
          )}
        </div>

        {resultCount !== undefined && (
          <p className="mt-2 text-xs text-ink-500">
            {resultCount.toLocaleString('en-IN')} restaurants mile
            {filters.city ? ` ${filters.city} me` : ''}
          </p>
        )}
      </div>

      {/* ================= all-filters modal ================= */}
      <Modal
        open={showAll}
        title="Filters"
        onClose={() => setShowAll(false)}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                onReset();
                setShowAll(false);
              }}
              className="btn-outline"
            >
              Clear all
            </button>
            <button type="button" onClick={() => setShowAll(false)} className="btn-primary">
              {resultCount !== undefined ? `View ${resultCount} results` : 'Apply'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* ---- rating ---- */}
          <Group title="Rating">
            <div className="flex flex-wrap gap-2">
              {[3.5, 4, 4.5].map((r) => (
                <Chip
                  key={r}
                  active={filters.minRating === r}
                  onClick={() => onChange({ minRating: filters.minRating === r ? undefined : r, pageNumber: 1 })}
                >
                  {r}+ stars
                </Chip>
              ))}
            </div>
          </Group>

          {/* ---- cost for two ---- */}
          <Group title="Cost for two">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Rs 500 tak', max: 500 },
                { label: 'Rs 1000 tak', max: 1000 },
                { label: 'Rs 2000 tak', max: 2000 },
                { label: 'Rs 2000+', min: 2000 },
              ].map((b) => (
                <Chip
                  key={b.label}
                  active={
                    b.max !== undefined
                      ? filters.maxCostForTwo === b.max && !filters.minCostForTwo
                      : filters.minCostForTwo === b.min
                  }
                  onClick={() =>
                    onChange({
                      maxCostForTwo: b.max !== undefined && filters.maxCostForTwo !== b.max ? b.max : undefined,
                      minCostForTwo: b.min !== undefined && filters.minCostForTwo !== b.min ? b.min : undefined,
                      pageNumber: 1,
                    })
                  }
                >
                  {b.label}
                </Chip>
              ))}
            </div>
          </Group>

          {/* ---- delivery distance ---- */}
          <Group title="Delivery distance" hint="15 km is our maximum delivery range">
            <div className="flex flex-wrap gap-2">
              {[3, 5, 10, 15].map((km) => (
                <Chip
                  key={km}
                  active={filters.maxDistanceKm === km}
                  onClick={() =>
                    onChange({
                      maxDistanceKm: filters.maxDistanceKm === km ? undefined : km,
                      pageNumber: 1,
                    })
                  }
                >
                  {km} km tak
                </Chip>
              ))}
            </div>
          </Group>

          {/* ---- cuisines ---- */}
          <Group title="Cuisines">
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {(cuisines ?? []).map((c) => (
                <Chip key={c.cuisineId} active={selectedCuisines.includes(c.cuisineId)} onClick={() => toggleCuisine(c.cuisineId)}>
                  {c.name}
                  {c.restaurantCount ? <span className="text-ink-400">({c.restaurantCount})</span> : null}
                </Chip>
              ))}
            </div>
          </Group>

          {/* ---- locality ---- */}
          <Group title="Locality">
            <select
              value={filters.locality ?? ''}
              onChange={(e) => onChange({ locality: e.target.value || undefined, pageNumber: 1 })}
              className="select"
            >
              <option value="">All localities</option>
              {(localities ?? []).map((l) => (
                <option key={`${l.city}-${l.locality}`} value={l.locality}>
                  {l.locality}, {l.city} ({l.restaurantCount})
                </option>
              ))}
            </select>
          </Group>

          {/* ---- features ---- */}
          <Group title="Features">
            <div className="flex flex-wrap gap-2">
              <Chip active={!!filters.pureVegOnly} onClick={() => onChange({ pureVegOnly: !filters.pureVegOnly, pageNumber: 1 })}>
                Pure veg
              </Chip>
              <Chip active={!!filters.outdoorSeating} onClick={() => onChange({ outdoorSeating: !filters.outdoorSeating, pageNumber: 1 })}>
                Outdoor seating
              </Chip>
              <Chip active={!!filters.petFriendly} onClick={() => onChange({ petFriendly: !filters.petFriendly, pageNumber: 1 })}>
                Pet friendly
              </Chip>
              <Chip active={!!filters.servesAlcohol} onClick={() => onChange({ servesAlcohol: !filters.servesAlcohol, pageNumber: 1 })}>
                Serves alcohol
              </Chip>
              <Chip active={!!filters.hasTableBooking} onClick={() => onChange({ hasTableBooking: !filters.hasTableBooking, pageNumber: 1 })}>
                Table booking
              </Chip>
              <Chip active={!!filters.hasHallBooking} onClick={() => onChange({ hasHallBooking: !filters.hasHallBooking, pageNumber: 1 })}>
                Party hall
              </Chip>
              <Chip active={!!filters.openNow} onClick={() => onChange({ openNow: !filters.openNow, pageNumber: 1 })}>
                Open now
              </Chip>
              <Chip active={!!filters.hasOffers} onClick={() => onChange({ hasOffers: !filters.hasOffers, pageNumber: 1 })}>
                Has running offers
              </Chip>
            </div>
          </Group>
        </div>
      </Modal>
    </>
  );
}

/* --------------------------------------------------------------- */

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`chip shrink-0 ${active ? 'chip-active' : ''}`}
    >
      {children}
      {active && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3">
          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink-800">{title}</h3>
      {hint && <p className="mb-2 text-xs text-ink-400">{hint}</p>}
      {children}
    </div>
  );
}
