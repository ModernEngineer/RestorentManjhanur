import { DELIVERY_SLABS, MAX_DELIVERY_KM } from '@/context/deliveryAreas';
import { useLocationCtx } from '@/context/LocationContext';

/**
 * Delivery charge ki rate list.
 * Customer ko order karte waqt saaf dikh jaata hai ki kis doori par
 * kitna charge lagega, aur abhi uske address par kaunsa slab lag raha hai.
 */
export default function DeliveryRateCard({
  distanceKm,
  currentFee,
  compact = false,
}: {
  /** Abhi wale address ki doori - us slab ko highlight karne ke liye */
  distanceKm?: number | null;
  /** Server se aaya actual fee - agar diya to wahi dikhaya jaata hai */
  currentFee?: number | null;
  compact?: boolean;
}) {
  const { currency } = useLocationCtx();

  const activeIndex =
    distanceKm === null || distanceKm === undefined || distanceKm > MAX_DELIVERY_KM
      ? -1
      : DELIVERY_SLABS.findIndex((s) => distanceKm <= s.upToKm);

  return (
    <div className={compact ? '' : 'rounded-xl border border-ink-200 bg-ink-50 p-4'}>
      <div className="mb-2 flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 shrink-0 text-ink-500">
          <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="5.5" cy="18.5" r="2" />
          <circle cx="18.5" cy="18.5" r="2" />
        </svg>
        <p className="text-sm font-semibold text-ink-800">Delivery charge</p>
      </div>

      <ul className="divide-y divide-ink-200/70">
        {DELIVERY_SLABS.map((slab, i) => {
          const active = i === activeIndex;

          return (
            <li
              key={slab.upToKm}
              className={`flex items-center justify-between gap-3 px-2 py-1.5 text-sm ${
                active ? '-mx-2 rounded-lg bg-brand-50 px-4 font-semibold text-brand-800' : 'text-ink-600'
              }`}
            >
              <span className="flex items-center gap-2">
                {slab.label}
                {active && (
                  <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    YOURS
                  </span>
                )}
              </span>

              <span className={active ? 'text-brand-800' : 'font-medium text-ink-800'}>
                {currency(slab.fee)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* ---- abhi ka actual charge ---- */}
      {distanceKm !== null && distanceKm !== undefined && (
        <p className="mt-2.5 border-t border-ink-200 pt-2.5 text-sm">
          {distanceKm > MAX_DELIVERY_KM ? (
            <span className="font-semibold text-brand-700">
              Your address {distanceKm} km door hai - {MAX_DELIVERY_KM} km se bahar delivery nahi
              hoti.
            </span>
          ) : (
            <span className="text-ink-700">
              Your address <strong>{distanceKm} km</strong> door hai, isliye delivery charge{' '}
              <strong className="text-ink-900">
                {currency(currentFee ?? DELIVERY_SLABS[activeIndex]?.fee ?? 0)}
              </strong>{' '}
              lagega.
            </span>
          )}
        </p>
      )}

      <p className="mt-2 text-xs text-ink-400">
        {MAX_DELIVERY_KM} km tak delivery hoti hai. Charge order ke total me add ho jaata hai.
      </p>
    </div>
  );
}
