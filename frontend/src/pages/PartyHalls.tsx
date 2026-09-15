import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { hallApi } from '@/api/endpoints';
import { Badge, CardGridSkeleton, EmptyState, ErrorBanner, RatingBadge, SafeImage } from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

const CAPACITY_BUCKETS = [
  { label: '20-50 guests', value: 20 },
  { label: '50-100 guests', value: 50 },
  { label: '100-200 guests', value: 100 },
  { label: '200+ guests', value: 200 },
];

const BUDGET_BUCKETS = [
  { label: 'Rs 800/plate tak', value: 800 },
  { label: 'Rs 1000/plate tak', value: 1000 },
  { label: 'Rs 1500/plate tak', value: 1500 },
];

export default function PartyHalls() {
  usePageTitle('Party halls - birthday & event booking');

  const [params] = useSearchParams();
  const { location, currency } = useLocationCtx();

  const [city, setCity] = useState(params.get('city') ?? location.city);
  const [minCapacity, setMinCapacity] = useState<number | undefined>(undefined);
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);

  const restaurantId = params.get('restaurantId');

  const { data, isLoading, error, reload } = useAsync(
    () =>
      hallApi.list({
        restaurantId: restaurantId ? Number(restaurantId) : undefined,
        city: restaurantId ? undefined : city || undefined,
        minGuestCapacity: minCapacity,
        maxBudgetPerPlate: maxBudget,
      }),
    [restaurantId, city, minCapacity, maxBudget],
  );

  const parseAmenities = (json?: string | null): string[] => {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="container-app py-6">
      {/* ---------------- hero strip ---------------- */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-ink-900">
        <div className="relative">
          <SafeImage
            src="https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1600&q=80&auto=format&fit=crop"
            alt=""
            className="h-40 w-full object-cover opacity-40 sm:h-52"
          />

          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
            <span className="badge w-fit bg-white/15 text-white ring-1 ring-white/25">
              Birthday - Anniversary - Kitty party - Corporate
            </span>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Party halls</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              Book a hall and add decoration and cake in the same booking. It is confirmed once
              you pay 30% in advance.
            </p>
          </div>
        </div>
      </div>

      {/* ---------------- filters ---------------- */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {!restaurantId && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="select w-auto !py-2 text-sm"
            aria-label="City"
          >
            <option value="">All cities</option>
            <option value="New Delhi">New Delhi</option>
            <option value="Gurgaon">Gurgaon</option>
            <option value="Noida">Noida</option>
            <option value="Ghaziabad">Ghaziabad</option>
          </select>
        )}

        {CAPACITY_BUCKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => setMinCapacity(minCapacity === b.value ? undefined : b.value)}
            className={`chip ${minCapacity === b.value ? 'chip-active' : ''}`}
          >
            {b.label}
          </button>
        ))}

        {BUDGET_BUCKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => setMaxBudget(maxBudget === b.value ? undefined : b.value)}
            className={`chip ${maxBudget === b.value ? 'chip-active' : ''}`}
          >
            {b.label}
          </button>
        ))}

        {(minCapacity || maxBudget) && (
          <button
            type="button"
            onClick={() => {
              setMinCapacity(undefined);
              setMaxBudget(undefined);
            }}
            className="btn-ghost btn-sm"
          >
            Clear
          </button>
        )}

        {restaurantId && (
          <Link to="/party-halls" className="btn-ghost btn-sm">
            Browse all halls
          </Link>
        )}
      </div>

      {/* ---------------- list ---------------- */}
      {error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : isLoading ? (
        <CardGridSkeleton count={6} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No halls found"
          description="Try adjusting the capacity or budget filter."
          action={
            <button
              type="button"
              onClick={() => {
                setMinCapacity(undefined);
                setMaxBudget(undefined);
              }}
              className="btn-primary"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-500">{data!.length} halls mile</p>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data!.map((h) => {
              const amenities = parseAmenities(h.amenitiesJson);

              return (
                <Link key={h.hallId} to={`/party-halls/${h.hallId}`} className="card-hover group overflow-hidden">
                  <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
                    <SafeImage
                      src={h.imageUrl}
                      alt={h.name}
                      className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
                    />

                    <span className="absolute top-2 left-2 rounded bg-ink-900/75 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase backdrop-blur">
                      {h.minCapacity}-{h.maxCapacity} guests
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-base font-semibold text-ink-900">{h.name}</h2>
                      {h.restaurantRating ? <RatingBadge value={h.restaurantRating} /> : null}
                    </div>

                    <p className="mt-0.5 truncate text-sm text-ink-500">
                      {h.restaurantName} - {h.locality}, {h.city}
                    </p>

                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className="text-lg font-bold text-ink-900">{currency(h.pricePerPlate)}</span>
                      <span className="text-xs text-ink-500">per plate</span>
                    </div>

                    <p className="text-xs text-ink-400">+ {currency(h.baseRent)} hall rent</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {h.hasAC && <Badge tone="blue">AC</Badge>}
                      {h.hasDJ && <Badge tone="purple">DJ</Badge>}
                      {h.hasParking && <Badge>Parking</Badge>}
                      {amenities.slice(0, 2).map((a) => (
                        <Badge key={a}>{a}</Badge>
                      ))}
                    </div>

                    {h.completedEvents ? (
                      <p className="mt-2.5 text-xs font-medium text-rating-500">
                        {h.completedEvents} events yahan ho chuke hain
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
