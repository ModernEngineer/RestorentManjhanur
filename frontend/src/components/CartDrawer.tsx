import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useLocationCtx } from '@/context/LocationContext';
import { SafeImage, VegMark } from './ui';

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  const { currency } = useLocationCtx();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-900/50"
        aria-label="Close cart"
        tabIndex={-1}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in flex-col bg-white shadow-pop"
      >
        {/* ---------------- header ---------------- */}
        <header className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-900">Your cart</h2>
            {cart.restaurantName ? (
              <Link
                to={`/restaurant/${cart.restaurantSlug}`}
                onClick={onClose}
                className="truncate text-sm text-brand-700 hover:underline"
              >
                {cart.restaurantName}
              </Link>
            ) : (
              <p className="text-sm text-ink-500">Currently empty</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* ---------------- lines ---------------- */}
        {cart.isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-ink-100 text-ink-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-8">
                <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13 5.4 5M7 13l-2 5h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-ink-800">Your cart is empty</p>
              <p className="mt-1 text-sm text-ink-500">
                Order something - we deliver up to 15 km.
              </p>
            </div>
            <Link to="/restaurants" onClick={onClose} className="btn-primary">
              Browse restaurants
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {cart.lines.map((line) => (
                  <li key={line.foodItemId} className="flex gap-3">
                    <SafeImage
                      src={line.imageUrl}
                      alt={line.name}
                      className="size-16 shrink-0 rounded-lg object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <VegMark isVeg={line.isVeg} />
                        <p className="truncate text-sm font-semibold text-ink-900">{line.name}</p>
                      </div>

                      <p className="mt-0.5 text-sm text-ink-500">{currency(line.price)} each</p>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center rounded-lg border border-ink-200">
                          <button
                            type="button"
                            onClick={() => cart.decrement(line.foodItemId)}
                            className="cursor-pointer px-2.5 py-1 text-sm font-bold text-ink-600 transition hover:bg-ink-50"
                            aria-label="Decrease"
                          >
                            -
                          </button>
                          <span className="min-w-7 text-center text-sm font-bold text-ink-800">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => cart.increment(line.foodItemId)}
                            className="cursor-pointer px-2.5 py-1 text-sm font-bold text-ink-600 transition hover:bg-ink-50"
                            aria-label="Increase"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => cart.remove(line.foodItemId)}
                          className="cursor-pointer text-xs font-semibold text-ink-400 transition hover:text-brand-700"
                        >
                          Hatao
                        </button>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-ink-900">
                      {currency(line.price * line.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={cart.clear}
                className="mt-6 cursor-pointer text-xs font-semibold text-ink-400 transition hover:text-brand-700"
              >
                Clear the whole cart
              </button>
            </div>

            {/* ---------------- footer ---------------- */}
            <footer className="border-t border-ink-100 bg-ink-50 px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-600">
                  Item total ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
                </span>
                <span className="font-bold text-ink-900">{currency(cart.subTotal)}</span>
              </div>

              <p className="mt-1 text-xs text-ink-400">
                Delivery charge, packaging and taxes are added at checkout.
              </p>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/checkout');
                }}
                className="btn-primary mt-3 w-full py-3"
              >
                Go to checkout
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
