import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* ============================================================
   Home page ke corner me chhota promo widget (bottom-LEFT).

   Video:  frontend/public/videos/corner-promo.mp4
   Video na ho to neeche wali animation chalti hai - widget kabhi
   khaali ya toota hua nahi dikhta.

   WhatsApp button bottom-RIGHT me hai, isliye ye left me rakha hai.
   ============================================================ */

const PROMO_VIDEO = '/videos/corner-promo.mp4';
const DISMISS_KEY = 'fm_corner_promo_closed';

export default function CornerPromo() {
  const [closed, setClosed] = useState(true);   // pehle band, mount hone par decide
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [videoOk, setVideoOk] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);

  /* thoda scroll hone ke baad dikhao - hero par distraction na ho */
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch { /* private mode */ }

    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.6) {
        setClosed(false);
        window.removeEventListener('scroll', onScroll);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* reduced-motion wale users ke liye animation band */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) setPlaying(false);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    setPlaying((p) => {
      const next = !p;
      if (v) {
        if (next) void v.play().catch(() => undefined);
        else v.pause();
      }
      return next;
    });
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  };

  const dismiss = () => {
    setClosed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (closed) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-[55] animate-fade-up sm:bottom-6 sm:left-6 ${
        expanded ? 'w-[min(22rem,calc(100vw-2rem))]' : 'w-52 sm:w-60'
      } transition-[width] duration-300`}
    >
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-pop">
        {/* ==================== media ==================== */}
        <div className="relative aspect-video bg-ink-900">
          {videoOk ? (
            <video
              ref={videoRef}
              src={PROMO_VIDEO}
              className="size-full object-cover"
              autoPlay
              muted={muted}
              loop
              playsInline
              preload="metadata"
              onError={() => setVideoOk(false)}
              aria-label="FoodMitra promo video"
            />
          ) : (
            <DeliveryAnimation running={playing} />
          )}

          {/* ---- close ---- */}
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-1.5 right-1.5 grid size-6 cursor-pointer place-items-center rounded-full bg-ink-900/55 text-white backdrop-blur transition hover:bg-ink-900/80"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>

          {/* ---- controls ---- */}
          <div className="absolute bottom-1.5 left-1.5 flex gap-1.5">
            <ControlButton
              onClick={togglePlay}
              label={playing ? 'Roko' : 'Chalao'}
              icon={
                playing ? (
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )
              }
            />

            {videoOk && (
              <ControlButton
                onClick={toggleMute}
                label={muted ? 'Awaaz chalao' : 'Mute'}
                icon={
                  muted ? (
                    <path d="M11 5 6 9H3v6h3l5 4V5zM17 9l4 6m0-6-4 6" />
                  ) : (
                    <path d="M11 5 6 9H3v6h3l5 4V5zM16 8a5 5 0 0 1 0 8" />
                  )
                }
                stroke
              />
            )}

            <ControlButton
              onClick={() => setExpanded((e) => !e)}
              label={expanded ? 'Shrink' : 'Expand'}
              icon={
                expanded ? (
                  <path d="M9 9H4m5 0V4m6 5h5m-5 0V4M9 15H4m5 0v5m6-5h5m-5 0v5" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5" />
                )
              }
              stroke
            />
          </div>
        </div>

        {/* ==================== caption ==================== */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-brand-50">
            <span className="absolute inset-0 animate-[pulse-ring_2s_ease-out_infinite] rounded-full bg-brand-400" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="relative size-4 text-brand-600">
              <path d="M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" strokeLinecap="round" />
            </svg>
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-ink-900">30 minute me delivery</p>
            <p className="truncate text-[11px] text-ink-500">15 km tak - charge Rs 20 se</p>
          </div>

          <Link to="/restaurants" className="btn-primary btn-sm shrink-0 !px-2.5">
            Order
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ================================================================= */

function ControlButton({
  onClick,
  label,
  icon,
  stroke = false,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  stroke?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-6 cursor-pointer place-items-center rounded-full bg-ink-900/55 text-white backdrop-blur transition hover:bg-ink-900/80"
    >
      <svg
        viewBox="0 0 24 24"
        fill={stroke ? 'none' : 'currentColor'}
        stroke={stroke ? 'currentColor' : 'none'}
        strokeWidth={stroke ? 2 : 0}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3"
      >
        {icon}
      </svg>
    </button>
  );
}

/* ================================================================= */
/*        Video na ho to ye animation chalti hai (pure CSS/SVG)      */
/* ================================================================= */

function DeliveryAnimation({ running }: { running: boolean }) {
  const play = (css: string) => (running ? css : 'none');

  return (
    <div className="relative size-full overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-ink-900">
      {/* ---- peeche se guzarte hue bubbles ---- */}
      {[
        { size: 26, top: '14%', delay: '0s', dur: '7s', o: 0.16 },
        { size: 14, top: '34%', delay: '1.4s', dur: '5.5s', o: 0.2 },
        { size: 34, top: '58%', delay: '2.6s', dur: '8s', o: 0.12 },
        { size: 18, top: '72%', delay: '3.8s', dur: '6.2s', o: 0.18 },
      ].map((b, i) => (
        <span
          key={i}
          className="absolute right-0 rounded-full bg-white"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            opacity: b.o,
            animation: play(`drift ${b.dur} linear ${b.delay} infinite`),
          }}
        />
      ))}

      {/* ---- scooter + road ---- */}
      <svg viewBox="0 0 200 112" className="relative size-full" aria-hidden="true">
        {/* road */}
        <line x1="0" y1="92" x2="200" y2="92" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        <line
          x1="0"
          y1="92"
          x2="200"
          y2="92"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="2"
          strokeDasharray="14 14"
          style={{ animation: play('road-dash 0.7s linear infinite') }}
        />

        {/* scooter group */}
        <g style={{ animation: play('bob 1.6s ease-in-out infinite') }}>
          {/* delivery box */}
          <rect x="62" y="44" width="26" height="20" rx="4" fill="#fff" />
          <rect x="66" y="49" width="18" height="3" rx="1.5" fill="#e23744" />
          <rect x="66" y="55" width="12" height="3" rx="1.5" fill="#e23744" />

          {/* bhaap */}
          {[0, 1, 2].map((i) => (
            <ellipse
              key={i}
              cx={69 + i * 7}
              cy={42}
              rx="2.6"
              ry="4"
              fill="rgba(255,255,255,0.75)"
              style={{ animation: play(`steam 2.2s ease-out ${i * 0.55}s infinite`) }}
            />
          ))}

          {/* body */}
          <path
            d="M88 64h22l8-12h10a4 4 0 0 1 0 8h-6l-9 14H92z"
            fill="#fff"
            opacity="0.96"
          />
          {/* handle */}
          <path d="M126 52 138 38h10" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* rider */}
          <circle cx="112" cy="34" r="8" fill="#ffd9a0" />
          <path d="M104 34a8 8 0 0 1 16 0z" fill="#1c1f24" />
          <path d="M108 42c-4 3-6 8-6 12h20c0-6-3-11-8-13z" fill="#1c1f24" />
        </g>

        {/* wheels */}
        {[
          { cx: 96, cy: 86 },
          { cx: 132, cy: 86 },
        ].map((w) => (
          <g key={w.cx} transform={`translate(${w.cx} ${w.cy})`}>
            <circle r="11" fill="#1c1f24" stroke="#fff" strokeWidth="2.5" />
            <g style={{ animation: play('spin-wheel 0.55s linear infinite'), transformOrigin: 'center' }}>
              <line x1="-6" y1="0" x2="6" y2="0" stroke="#fff" strokeWidth="1.6" />
              <line x1="0" y1="-6" x2="0" y2="6" stroke="#fff" strokeWidth="1.6" />
            </g>
          </g>
        ))}
      </svg>

      {/* ---- text ---- */}
      <div className="absolute inset-x-0 top-2.5 text-center">
        <p className="text-[11px] font-bold tracking-wide text-white/95 drop-shadow">
          Your food is on the way
        </p>
      </div>
    </div>
  );
}
