import { useEffect, useRef, useState } from 'react';
import { SafeImage, SectionHeading, StarPicker } from './ui';
import type { HomeCounters, Testimonial } from '@/types';

/**
 * "Happy customers" section - auto-scrolling testimonial carousel
 * plus counters (restaurants, orders delivered, avg rating).
 */
export default function Testimonials({
  testimonials,
  counters,
}: {
  testimonials: Testimonial[];
  counters?: HomeCounters | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  /* halka auto-scroll; hover/focus par ruk jaata hai */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || paused || testimonials.length < 3) return;

    const id = window.setInterval(() => {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      track.scrollBy({ left: atEnd ? -track.scrollWidth : 320, behavior: 'smooth' });
    }, 3800);

    return () => clearInterval(id);
  }, [paused, testimonials.length]);

  if (testimonials.length === 0) return null;

  const scroll = (dir: -1 | 1) =>
    trackRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });

  return (
    <section className="bg-white py-14">
      <div className="container-app">
        <SectionHeading
          title="Happy customers"
          subtitle="Real reviews from real people - this is what keeps us going"
          action={
            <div className="hidden gap-2 sm:flex">
              <button type="button" onClick={() => scroll(-1)} className="btn-outline size-9 !p-0" aria-label="Pichla">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" onClick={() => scroll(1)} className="btn-outline size-9 !p-0" aria-label="Agla">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          }
        />

        {/* ---------------- counters ---------------- */}
        {counters && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Counter value={counters.restaurantCount} label="Restaurants" suffix="+" />
            <Counter value={counters.deliveredOrderCount} label="Orders delivered" suffix="+" />
            <Counter value={counters.happyCustomerCount} label="Happy customers" suffix="+" />
            <Counter value={counters.avgRating} label="Average rating" decimals={1} suffix=" / 5" />
          </div>
        )}

        {/* ---------------- carousel ---------------- */}
        <div
          ref={trackRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 no-scrollbar"
        >
          {testimonials.map((t) => (
            <figure
              key={t.testimonialId}
              className="card flex w-[300px] shrink-0 snap-start flex-col p-5 sm:w-[340px]"
            >
              <StarPicker value={t.rating} readOnly size="sm" />

              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">
                <span className="mr-0.5 text-2xl leading-none text-brand-200">&ldquo;</span>
                {t.message}
              </blockquote>

              <figcaption className="mt-4 flex items-center gap-3 border-t border-ink-100 pt-4">
                {t.customerImage ? (
                  <SafeImage
                    src={t.customerImage}
                    alt={t.customerName}
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {t.customerName.charAt(0).toUpperCase()}
                  </span>
                )}

                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900">{t.customerName}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {[t.designation, t.city].filter(Boolean).join(' - ')}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- */

function Counter({
  value,
  label,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  label: string;
  suffix?: string;
  decimals?: number;
}) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  /* viewport me aane par count-up animation */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();

        const duration = 1100;
        const start = performance.now();

        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          // ease-out
          setShown(value * (1 - (1 - progress) ** 3));
          if (progress < 1) requestAnimationFrame(tick);
          else setShown(value);
        };

        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="rounded-xl bg-ink-50 px-4 py-4 text-center">
      <p className="text-2xl font-extrabold text-brand-600 sm:text-3xl">
        {shown.toLocaleString('en-IN', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </p>
      <p className="mt-0.5 text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
    </div>
  );
}
