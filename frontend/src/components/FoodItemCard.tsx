import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { ConfirmDialog, RatingBadge, SafeImage, VegMark } from './ui';
import type { FoodItem } from '@/types';

interface Props {
  item: FoodItem;
  restaurant: { id: number; name: string; slug: string };
  /** Restaurant band hai ya delivery range se bahar hai to add disable */
  disabled?: boolean;
  disabledReason?: string;
}

export default function FoodItemCard({ item, restaurant, disabled, disabledReason }: Props) {
  const cart = useCart();
  const { currency } = useLocationCtx();
  const toast = useToast();
  const [conflict, setConflict] = useState(false);

  const qty = cart.quantityOf(item.foodItemId);
  const unavailable = !item.isAvailable || disabled;

  const handleAdd = () => {
    if (unavailable) {
      toast.info(disabledReason ?? 'This item is not available right now.');
      return;
    }

    const result = cart.add(item, restaurant);
    if (result === 'conflict') setConflict(true);
    else toast.success(`${item.name} added to your cart.`);
  };

  return (
    <>
      <article className="flex gap-4 border-b border-ink-100 py-5 last:border-0">
        {/* ---------------- info ---------------- */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <VegMark isVeg={item.isVeg} />
            {item.isBestseller && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase">
                Bestseller
              </span>
            )}
          </div>

          <h3 className="mt-1.5 text-base leading-snug font-semibold text-ink-900">{item.name}</h3>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink-800">{currency(item.effectivePrice)}</span>

            {item.discountPrice !== null && item.discountPrice !== undefined && (
              <>
                <span className="text-sm text-ink-400 line-through">{currency(item.price)}</span>
                <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-bold text-green-700">
                  {item.discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          {item.rating > 0 && (
            <div className="mt-1.5">
              <RatingBadge value={item.rating} reviews={item.totalReviews} size="sm" />
            </div>
          )}

          {item.description && (
            <p className="mt-2 line-clamp-2 max-w-prose text-sm leading-relaxed text-ink-500">
              {item.description}
            </p>
          )}

          {item.servesCount && <p className="mt-1.5 text-xs text-ink-400">{item.servesCount}</p>}

          {!item.isAvailable && (
            <p className="mt-2 text-xs font-semibold text-brand-600">Currently out of stock</p>
          )}
        </div>

        {/* ---------------- image + add ---------------- */}
        <div className="w-28 shrink-0 sm:w-36">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-ink-100">
            <SafeImage src={item.imageUrl} alt={item.name} className="size-full object-cover" />

            {!item.isAvailable && (
              <div className="absolute inset-0 grid place-items-center bg-white/70">
                <span className="text-[11px] font-bold text-ink-600">Out of stock</span>
              </div>
            )}
          </div>

          {/* add / stepper */}
          <div className="mt-2">
            {qty === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                disabled={unavailable}
                className="w-full cursor-pointer rounded-lg border border-ink-200 bg-white py-2 text-sm font-bold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-ink-100 disabled:text-ink-300 disabled:hover:bg-white"
              >
                ADD
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-brand-500 bg-white">
                <button
                  type="button"
                  onClick={() => cart.decrement(item.foodItemId)}
                  className="cursor-pointer px-3 py-2 text-base leading-none font-bold text-brand-600 transition hover:bg-brand-50"
                  aria-label="Decrease by one"
                >
                  -
                </button>
                <span className="text-sm font-bold text-brand-700" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => cart.increment(item.foodItemId)}
                  className="cursor-pointer px-3 py-2 text-base leading-none font-bold text-brand-600 transition hover:bg-brand-50"
                  aria-label="Increase by one"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </article>

      {/* doosre restaurant ka cart pehle se hai */}
      <ConfirmDialog
        open={conflict}
        title="Your cart has items from another restaurant"
        message={`Your cart has items from "${cart.restaurantName}". An order can only contain items from one restaurant. Clear the cart and add "${item.name}"?`}
        confirmLabel="Yes, clear the cart"
        cancelLabel="No, keep it"
        onConfirm={() => {
          cart.replaceWith(item, restaurant);
          setConflict(false);
          toast.success(`Cart cleared and ${item.name} added.`);
        }}
        onCancel={() => setConflict(false)}
      />
    </>
  );
}
