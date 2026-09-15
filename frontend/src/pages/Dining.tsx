import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { restaurantApi } from '@/api/endpoints';
import FilterBar from '@/components/FilterBar';
import RestaurantCard from '@/components/RestaurantCard';
import { CardGridSkeleton, EmptyState, ErrorBanner, Pagination } from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';
import type { RestaurantFilters } from '@/types';

/**
 * "Dining out" - sirf wo restaurants jahan table booking hoti hai.
 * Card par click karke detail page par "Book a table" milta hai.
 */
export default function Dining() {
  usePageTitle('Dining out - table booking');

  const [params, setParams] = useSearchParams();
  const { location } = useLocationCtx();

  const filters = useMemo<RestaurantFilters>(() => {
    const num = (k: string) => {
      const v = params.get(k);
      const n = v === null || v === '' ? NaN : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const bool = (k: string) => params.get(k) === 'true';

    return {
      search: params.get('search') ?? undefined,
      city: params.get('city') ?? location.city,
      locality: params.get('locality') ?? undefined,
      cuisineIds: params.get('cuisineIds') ?? undefined,
      minRating: num('minRating'),
      minCostForTwo: num('minCostForTwo'),
      maxCostForTwo: num('maxCostForTwo'),
      pureVegOnly: bool('pureVegOnly'),
      outdoorSeating: bool('outdoorSeating'),
      petFriendly: bool('petFriendly'),
      servesAlcohol: bool('servesAlcohol'),
      openNow: bool('openNow'),
      hasOffers: bool('hasOffers'),
      hasHallBooking: bool('hasHallBooking'),
      maxDistanceKm: num('maxDistanceKm'),
      sortBy: params.get('sortBy') ?? 'rating',
      pageNumber: num('pageNumber') ?? 1,
      pageSize: 12,
      lat: location.lat ?? undefined,
      lng: location.lng ?? undefined,

      /* is page ki pehchaan - ye filter hamesha on rehta hai */
      hasTableBooking: true,
    };
  }, [params, location.city, location.lat, location.lng]);

  const patch = useCallback(
    (p: Partial<RestaurantFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(p)) {
            if (v === undefined || v === null || v === '' || v === false) next.delete(k);
            else next.set(k, String(v));
          }
          next.delete('lat');
          next.delete('lng');
          next.delete('pageSize');
          next.delete('hasTableBooking'); // implicit hai
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => {
    const city = params.get('city');
    const next = new URLSearchParams();
    if (city) next.set('city', city);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const { data, isLoading, error, reload } = useAsync(
    () => restaurantApi.search(filters),
    [JSON.stringify(filters)],
  );

  return (
    <div className="container-app py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">Dining out</h1>
        <p className="mt-1 text-sm text-ink-500">
          Table pehle se book karo - weekend par wait karne ki zaroorat nahi.
          {filters.city ? ` ${filters.city} me` : ''} {data?.totalCount ?? 0} restaurants table
          booking lete hain.
        </p>
      </div>

      <FilterBar filters={filters} onChange={patch} onReset={reset} resultCount={data?.totalCount} />

      <div className="mt-6">
        {error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : isLoading ? (
          <CardGridSkeleton count={6} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No restaurant with table booking found"
            description="Try removing filters or choosing another city."
            action={
              <button type="button" onClick={reset} className="btn-primary">
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data!.items.map((r) => (
                <RestaurantCard key={r.restaurantId} restaurant={r} />
              ))}
            </div>

            <div className="mt-8">
              <Pagination
                pageNumber={data!.pageNumber}
                totalPages={data!.totalPages}
                totalCount={data!.totalCount}
                onChange={(p) => {
                  patch({ pageNumber: p });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
