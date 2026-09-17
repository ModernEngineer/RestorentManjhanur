import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import homepageVideo from '@/assets/homepagebanner.mp4';
import logo from '@/assets/Tyke (1).png';
import { DELIVERY_AREAS, useLocationCtx } from '@/context/LocationContext';

/* ============================================================
   Zomato jaisa full-screen video hero slider.

   Apni videos yahan daalo:  frontend/public/videos/
   Neeche SLIDES array me file ka naam likha hai. Video na mile to
   poster image dikh jaati hai (page kabhi khaali nahi lagta),
   isliye videos aane se pehle bhi sab theek chalta hai.
   ============================================================ */

interface Slide {
  /** public/videos/ ke andar ki file */
  video: string;
  /** video load hone tak / na hone par ye image dikhti hai */
  poster: string;
  headline: string;
  sub: string;
}

const SLIDES: Slide[] = [
  {
    video: homepageVideo,
    poster:
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1920&q=80&auto=format&fit=crop',
    headline: "India ka #1\nfood delivery app",
    sub: 'Hot food in 30 minutes. Delivery up to 15 km - charges start at Rs 20.',
  },
  {
    video: homepageVideo,
    poster:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1920&q=80&auto=format&fit=crop',
    headline: 'Reserve your table\nin advance',
    sub: 'No waiting on weekends. The table you want, at the time you want.',
  },
  {
    video: homepageVideo,
    poster:
      'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1920&q=80&auto=format&fit=crop',
    headline: 'Party halls for\nbirthdays too',
    sub: 'Decoration, cake and menu - all in a single booking.',
  },
];

const SLIDE_MS = 7000;

export default function HeroVideoSlider() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [query, setQuery] = useState('');

  const navigate = useNavigate();
  const { location, setPreset, useMyLocation, isLocating, gpsError } = useLocationCtx();
  const [showPicker, setShowPicker] = useState(false);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  /* ---------- auto advance ---------- */
  useEffect(() => {
    if (isPaused) return;

    const t = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, isPaused]);

  /* ---------- sirf active video chale (battery + CPU bachao) ---------- */
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;

      if (i === index) {
        v.currentTime = 0;
        // autoplay browser block kar sakta hai - chup-chaap ignore karo,
        // poster image tab bhi dikhti rahegi
        void v.play().catch(() => undefined);
      } else {
        v.pause();
      }
    });
  }, [index]);

  /* ---------- reduced motion respect karo ---------- */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) setIsPaused(true);

    const onChange = (e: MediaQueryListEvent) => setIsPaused(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const onSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      if (location.city) params.set('city', location.city);
      navigate(`/restaurants?${params.toString()}`);
    },
    [query, location.city, navigate],
  );

  const slide = SLIDES[index];

  return (
    <section
      className="relative isolate h-[92vh] min-h-[560px] w-full overflow-hidden bg-ink-900"
      aria-label="FoodMitra highlights"
    >
      {/* ---------------- video layer ---------------- */}
      {SLIDES.map((s, i) => (
        <video
          key={s.video}
          ref={(el) => {
            videoRefs.current[i] = el;
          }}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
          src={s.video}
          poster={s.poster}
          muted
          loop
          playsInline
          preload={i === 0 ? 'auto' : 'none'}
          aria-hidden="true"
          tabIndex={-1}
        />
      ))}

      {/* ---------------- scrim (text readable rakhne ke liye) ---------------- */}
      <div className="hero-scrim absolute inset-0" aria-hidden="true" />

      {/* ---------------- content ---------------- */}
      <div className="relative z-10 flex h-full flex-col">
        <div className="container-app flex flex-1 flex-col items-center justify-center pt-20 pb-10 text-center">
          {/* wordmark */}
          <div className="flex items-center gap-3 text-white drop-shadow-lg">
            <img src={logo} alt="Food Mail logo" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/25 shadow-lg sm:h-16 sm:w-16" />
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Food <span className="text-brand-400">Mail</span>
            </h1>
          </div>

          {/* rotating headline */}
          <p
            key={index}
            className="mt-4 max-w-3xl animate-fade-up text-2xl leading-tight font-bold whitespace-pre-line text-white drop-shadow-lg sm:text-4xl lg:text-5xl"
          >
            {slide.headline}
          </p>

          <p
            key={`sub-${index}`}
            className="mt-3 max-w-xl animate-fade-up text-sm text-white/90 drop-shadow sm:text-lg"
          >
            {slide.sub}
          </p>

          {/* -------- location + search bar -------- */}
          <form
            onSubmit={onSearch}
            className="mt-8 flex w-full max-w-3xl flex-col gap-2 rounded-2xl bg-white/98 p-2 shadow-pop backdrop-blur sm:flex-row"
          >
            {/* location picker */}
            <div className="relative sm:w-64">
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-3 text-left transition hover:bg-ink-50"
                aria-expanded={showPicker}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 shrink-0 text-brand-600">
                  <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" strokeLinecap="round" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-800">
                    {location.label}
                  </span>
                  <span className="block text-[11px] text-ink-400">Change location</span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`size-4 shrink-0 text-ink-400 transition ${showPicker ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" />
                </svg>
              </button>

              {showPicker && (
                <div className="absolute top-full left-0 z-20 mt-2 max-h-80 w-full min-w-72 overflow-y-auto rounded-xl border border-ink-100 bg-white p-2 text-left shadow-pop">
                  <button
                    type="button"
                    onClick={() => { useMyLocation(); setShowPicker(false); }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="5" />
                    </svg>
                    {isLocating ? 'Finding your location...' : 'Use my current location'}
                  </button>

                  {gpsError && <p className="px-3 py-1.5 text-xs text-brand-700">{gpsError}</p>}

                  <div className="my-1 border-t border-ink-100" />

                  <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                    Delivery area - doori aur charge
                  </p>

                  {DELIVERY_AREAS.map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { setPreset(i); setShowPicker(false); }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-ink-50 ${
                        location.label === p.label ? 'bg-ink-50 font-semibold text-ink-900' : 'text-ink-600'
                      }`}
                    >
                      <span className="min-w-0 truncate">{p.label}</span>
                      <span className="shrink-0 text-xs text-ink-400">
                        ~{p.approxKm} km
                        {p.deliveryFee !== null && (
                          <span className="ml-1 font-semibold text-ink-600">Rs {p.deliveryFee}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="hidden w-px self-stretch bg-ink-100 sm:block" aria-hidden="true" />

            {/* search input */}
            <div className="flex flex-1 items-center gap-2 px-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 shrink-0 text-ink-400">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a restaurant, cuisine or dish"
                className="w-full bg-transparent py-3 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
                aria-label="Search"
              />
            </div>

            <button type="submit" className="btn-primary shrink-0 px-6 py-3">
              Search
            </button>
          </form>

          {/* -------- quick links -------- */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { to: '/restaurants', label: 'Order online' },
              { to: '/dining', label: 'Table booking' },
              { to: '/party-halls', label: 'Party halls' },
              { to: '/offers', label: 'Offers' },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* -------- dots + scroll cue -------- */}
        <div className="container-app flex flex-col items-center gap-4 pb-8">
          <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
            {SLIDES.map((s, i) => (
              <button
                key={s.video}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 cursor-pointer rounded-full transition-all ${
                  i === index ? 'w-8 bg-white' : 'w-3 bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}

            <button
              type="button"
              onClick={() => setIsPaused((v) => !v)}
              className="ml-2 cursor-pointer rounded-full bg-white/15 p-1.5 text-white transition hover:bg-white/25"
              aria-label={isPaused ? 'Slideshow chalao' : 'Slideshow roko'}
            >
              {isPaused ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              )}
            </button>
          </div>

          <a
            href="#home-sections"
            className="flex flex-col items-center gap-1 text-sm font-medium text-white/85 transition hover:text-white"
          >
            Scroll down
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 animate-bounce">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
