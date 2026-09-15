import { useState } from 'react';
import { reviewApi } from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAction } from '@/hooks/useAsync';
import { Modal, SafeImage, Spinner, StarPicker } from './ui';
import type { RatingBreakdown, Review } from '@/types';

interface Props {
  restaurantId: number;
  restaurantName: string;
  rating: number;
  totalReviews: number;
  reviews: Review[];
  breakdown?: RatingBreakdown[];
  /** Review add hone ke baad parent page refresh kar sake */
  onReviewAdded?: () => void;
}

export default function ReviewSection({
  restaurantId,
  restaurantName,
  rating,
  totalReviews,
  reviews,
  breakdown = [],
  onReviewAdded,
}: Props) {
  const { isAuthenticated, isCustomer } = useAuth();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());

  const like = async (reviewId: number) => {
    if (liked.has(reviewId)) return;
    try {
      await reviewApi.like(reviewId);
      setLiked((prev) => new Set(prev).add(reviewId));
    } catch {
      toast.error('Could not register your like.');
    }
  };

  const totalInBreakdown = breakdown.reduce((s, b) => s + b.countOfReviews, 0);

  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Reviews &amp; ratings</h2>
          <p className="mt-1 text-sm text-ink-500">
            {totalReviews.toLocaleString('en-IN')} logon ne rating di hai
          </p>
        </div>

        {isAuthenticated && isCustomer && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-outline btn-sm">
            Review likho
          </button>
        )}
      </div>

      {/* ---------------- summary + breakdown ---------------- */}
      <div className="card mb-6 flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center gap-1 sm:w-40">
          <p className="text-4xl font-extrabold text-ink-900">
            {rating > 0 ? rating.toFixed(1) : '--'}
          </p>
          <StarPicker value={rating} readOnly size="sm" />
          <p className="text-xs text-ink-500">{totalReviews.toLocaleString('en-IN')} ratings</p>
        </div>

        {totalInBreakdown > 0 && (
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = breakdown.find((b) => b.stars === star)?.countOfReviews ?? 0;
              const pct = totalInBreakdown > 0 ? (count / totalInBreakdown) * 100 : 0;

              return (
                <div key={star} className="flex items-center gap-2.5 text-xs">
                  <span className="w-6 shrink-0 text-right font-medium text-ink-600">{star}</span>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3 shrink-0 text-amber-400">
                    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
                  </svg>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span
                      className="block h-full rounded-full bg-rating-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-ink-500">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------- review list ---------------- */}
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 bg-white px-5 py-10 text-center text-sm text-ink-500">
          No reviews yet. Be the first to write one!
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((rv) => (
            <li key={rv.reviewId} className="card p-5">
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
                    {rv.orderNumber && (
                      <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-green-700 uppercase">
                        Verified order
                      </span>
                    )}
                    <span className="text-xs text-ink-400">
                      {new Date(rv.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <StarPicker value={rv.rating} readOnly size="sm" />
                    {rv.foodRating ? (
                      <span className="text-xs text-ink-500">Food {rv.foodRating}/5</span>
                    ) : null}
                    {rv.serviceRating ? (
                      <span className="text-xs text-ink-500">Service {rv.serviceRating}/5</span>
                    ) : null}
                  </div>

                  {rv.title && <p className="mt-2 text-sm font-semibold text-ink-800">{rv.title}</p>}
                  {rv.comment && <p className="mt-1 text-sm leading-relaxed text-ink-600">{rv.comment}</p>}

                  {rv.imageUrl && (
                    <SafeImage
                      src={rv.imageUrl}
                      alt="Review photo"
                      className="mt-3 h-32 w-auto rounded-lg object-cover"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => like(rv.reviewId)}
                    disabled={liked.has(rv.reviewId)}
                    className="mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-500 transition hover:text-brand-700 disabled:cursor-default disabled:text-brand-700"
                  >
                    <svg viewBox="0 0 24 24" fill={liked.has(rv.reviewId) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="size-4">
                      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4.4-7.3a1.5 1.5 0 0 1 2.7 1.2L13 10h5.5a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7" strokeLinecap="round" />
                    </svg>
                    Helpful {rv.likeCount + (liked.has(rv.reviewId) ? 1 : 0) > 0 ? `(${rv.likeCount + (liked.has(rv.reviewId) ? 1 : 0)})` : ''}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ---------------- add review modal ---------------- */}
      <ReviewFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        onSaved={() => {
          setShowForm(false);
          onReviewAdded?.();
        }}
      />
    </section>
  );
}

/* --------------------------------------------------------------- */

function ReviewFormModal({
  open,
  onClose,
  restaurantId,
  restaurantName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: number;
  restaurantName: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [orderId, setOrderId] = useState('');

  const { run, isBusy, error } = useAction(reviewApi.add);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await run({
      restaurantId,
      orderId: orderId.trim() ? Number(orderId.trim()) : undefined,
      rating,
      foodRating,
      serviceRating,
      title: title.trim() || undefined,
      comment: comment.trim() || undefined,
    });

    if (result) {
      toast.success(result.message || 'Review added. Thank you!');
      setTitle('');
      setComment('');
      setOrderId('');
      onSaved();
    }
  };

  return (
    <Modal
      open={open}
      title={`Rate ${restaurantName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={isBusy}>
            Cancel
          </button>
          <button type="submit" form="review-form" className="btn-primary" disabled={isBusy}>
            {isBusy && <Spinner className="size-4" />}
            Review post karo
          </button>
        </>
      }
    >
      <form id="review-form" onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Overall rating</span>
          <StarPicker value={rating} onChange={setRating} size="lg" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">How was the food?</span>
            <StarPicker value={foodRating} onChange={setFoodRating} />
          </div>
          <div>
            <span className="label">Service kaisi thi?</span>
            <StarPicker value={serviceRating} onChange={setServiceRating} />
          </div>
        </div>

        <div>
          <label htmlFor="rv-title" className="label">
            Title (optional)
          </label>
          <input
            id="rv-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            placeholder="e.g. The butter chicken was amazing"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="rv-comment" className="label">
            Your experience
          </label>
          <textarea
            id="rv-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Food, packaging, delivery time - write anything that would help others."
            className="input resize-y"
          />
        </div>

        <div>
          <label htmlFor="rv-order" className="label">
            Order ID (optional)
          </label>
          <input
            id="rv-order"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="e.g. 1001"
            className="input"
          />
          <p className="mt-1 text-xs text-ink-400">
            Delivered order ka ID doge to review par "Verified order" ka badge lagega.
          </p>
        </div>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
