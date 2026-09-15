import { useState } from 'react';
import { adminApi } from '@/api/endpoints';
import {
  Badge, EmptyState, ErrorBanner, Pagination, RowsSkeleton, SafeImage, Spinner, StarPicker,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

export default function AdminReviews() {
  usePageTitle('Reviews');

  const toast = useToast();

  const [filter, setFilter] = useState<'' | 'pending' | 'approved'>('');
  const [restaurantId, setRestaurantId] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reviews = useAsync(
    () =>
      adminApi.reviews({
        restaurantId: restaurantId ? Number(restaurantId) : undefined,
        isApproved: filter === '' ? undefined : filter === 'approved',
        pageNumber: page,
        pageSize: 20,
      }),
    [filter, restaurantId, page],
  );

  const restaurants = useAsync(() => adminApi.restaurants({ pageSize: 100 }), []);

  const moderate = async (reviewId: number, approve: boolean) => {
    setBusyId(reviewId);
    try {
      await adminApi.moderateReview(reviewId, approve);
      toast.success(approve ? 'Review approved.' : 'Review hidden.');
      reviews.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Reviews</h1>
        <p className="text-sm text-ink-500">
          Hiding a review automatically recalculates the restaurant's average rating.
        </p>
      </div>

      {/* ---------------- filters ---------------- */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-56 flex-1">
          <label htmlFor="rv-rest" className="label">Restaurant</label>
          <select
            id="rv-rest"
            value={restaurantId}
            onChange={(e) => {
              setRestaurantId(e.target.value);
              setPage(1);
            }}
            className="select"
          >
            <option value="">All restaurants</option>
            {(restaurants.data?.items ?? []).map((r) => (
              <option key={r.restaurantId} value={r.restaurantId}>
                {r.name} - {r.locality}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {(
            [
              { key: '', label: 'All' },
              { key: 'pending', label: 'Hidden' },
              { key: 'approved', label: 'Live' },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className={`chip ${filter === f.key ? 'chip-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- list ---------------- */}
      {reviews.error ? (
        <ErrorBanner message={reviews.error} onRetry={reviews.reload} />
      ) : reviews.isLoading ? (
        <RowsSkeleton rows={5} />
      ) : (reviews.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No reviews found" description="No reviews match this filter." />
      ) : (
        <>
          <ul className="space-y-3">
            {reviews.data!.items.map((rv) => (
              <li key={rv.reviewId} className="card p-4">
                <div className="flex items-start gap-3">
                  {rv.userImage ? (
                    <SafeImage src={rv.userImage} alt={rv.userName} className="size-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-100 text-sm font-bold text-ink-500">
                      {rv.userName?.charAt(0).toUpperCase() ?? '?'}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">{rv.userName}</p>
                      <Badge tone={rv.isApproved ? 'green' : 'gray'}>
                        {rv.isApproved ? 'Live' : 'Hidden'}
                      </Badge>
                      {rv.orderNumber && <Badge tone="blue">Verified order</Badge>}
                    </div>

                    <p className="mt-0.5 truncate text-xs text-ink-500">{rv.restaurantName}</p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <StarPicker value={rv.rating} readOnly size="sm" />
                      {rv.foodRating ? <span className="text-xs text-ink-500">Food {rv.foodRating}/5</span> : null}
                      {rv.serviceRating ? <span className="text-xs text-ink-500">Service {rv.serviceRating}/5</span> : null}
                      <span className="text-xs text-ink-400">
                        {new Date(rv.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {rv.title && <p className="mt-2 text-sm font-semibold text-ink-800">{rv.title}</p>}
                    {rv.comment && <p className="mt-1 text-sm leading-relaxed text-ink-600">{rv.comment}</p>}

                    {rv.imageUrl && (
                      <SafeImage src={rv.imageUrl} alt="Review" className="mt-2 h-24 w-auto rounded-lg object-cover" />
                    )}

                    <p className="mt-2 text-xs text-ink-400">{rv.likeCount} logon ko helpful laga</p>
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => moderate(rv.reviewId, !rv.isApproved)}
                      disabled={busyId === rv.reviewId}
                      className={`btn-sm ${rv.isApproved ? 'btn-ghost !text-brand-700' : 'btn-success'}`}
                    >
                      {busyId === rv.reviewId && <Spinner className="size-3.5" />}
                      {rv.isApproved ? 'Hide' : 'Approve'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            pageNumber={reviews.data!.pageNumber}
            totalPages={reviews.data!.totalPages}
            totalCount={reviews.data!.totalCount}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
