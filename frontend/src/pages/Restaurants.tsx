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
 * Zomato ka "/ncr/restaurants" jaisa listing page.
 * Saare filters URL me rehte hain, isliye link share ho sakta hai
 * aur back/forward button sahi kaam karta hai.
 */
export default function Restaurants() {
  usePageTitle('Restaurants');

  const [params, setParams] = useSearchParams();
  const { location } = useLocationCtx();

  /* ---------- URL -> filters ---------- */
  const filters = useMemo<RestaurantFilters>(() => {
    const num = (key: string) => {
      const v = params.get(key);
      if (v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const bool = (key: string) => params.get(key) === 'true';

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
      hasTableBooking: bool('hasTableBooking'),
      hasHallBooking: bool('hasHallBooking'),
      maxDistanceKm: num('maxDistanceKm'),
      onlyDeliverable: bool('onlyDeliverable'),
      sortBy: params.get('sortBy') ?? 'relevance',
      pageNumber: num('pageNumber') ?? 1,
      pageSize: 12,
      lat: location.lat ?? undefined,
      lng: location.lng ?? undefined,
    };
  }, [params, location.city, location.lat, location.lng]);

  /* ---------- filters -> URL ---------- */
  const patchFilters = useCallback(
    (patch: Partial<RestaurantFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === '' || value === false) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }

          // lat/lng URL me nahi rakhte - wo LocationContext se aate hain
          next.delete('lat');
          next.delete('lng');
          next.delete('pageSize');

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

  const goToPage = (page: number) => {
    patchFilters({ pageNumber: page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container-app py-6">
      {/* ---------------- heading ---------------- */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">
          {filters.search
            ? `"${filters.search}" ke results`
            : `Restaurants ${filters.city ? `in ${filters.city}` : ''}`}
        </h1>

        <p className="mt-1 text-sm text-ink-500">
          {location.lat
            ? `${location.label} se distance ke saath - 15 km tak delivery available`
            : 'Choose a location and we will also show distance and delivery charge'}
        </p>
      </div>

      {/* ---------------- filters ---------------- */}
      <FilterBar
        filters={filters}
        onChange={patchFilters}
        onReset={reset}
        resultCount={data?.totalCount}
      />

      {/* ---------------- results ---------------- */}
      <div className="mt-6">
        {error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : isLoading ? (
          <CardGridSkeleton count={6} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No restaurants found"
            description="Try loosening the filters or picking another locality. Press 'Clear all' to remove every filter."
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
                onChange={goToPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
