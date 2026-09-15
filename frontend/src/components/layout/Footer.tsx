import { Link } from 'react-router-dom';
import { useLocationCtx } from '@/context/LocationContext';

export default function Footer() {
  const { settings, whatsAppLink } = useLocationCtx();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: 'FoodMitra',
      links: [
        { to: '/restaurants', label: 'Order online' },
        { to: '/dining', label: 'Dining out' },
        { to: '/party-halls', label: 'Party halls' },
        { to: '/offers', label: 'Offers aur coupons' },
      ],
    },
    {
      title: 'My account',
      links: [
        { to: '/my-orders', label: 'My orders' },
        { to: '/my-bookings', label: 'My bookings' },
        { to: '/profile', label: 'Profile aur address' },
        { to: '/login', label: 'Login / Sign up' },
      ],
    },
    {
      title: 'Cities',
      links: [
        { to: '/restaurants?city=New%20Delhi', label: 'New Delhi' },
        { to: '/restaurants?city=Gurgaon', label: 'Gurgaon' },
        { to: '/restaurants?city=Noida', label: 'Noida' },
        { to: '/restaurants?city=Ghaziabad', label: 'Ghaziabad' },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-ink-100 bg-white">
      <div className="container-app py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* ---------------- brand ---------------- */}
          <div>
            <p className="text-xl font-extrabold tracking-tight">
              <span className="text-ink-900">food</span>
              <span className="text-brand-600">mitra</span>
            </p>

            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              {settings.SiteName ?? 'FoodMitra'} - khana order karo, table book karo ya birthday
              party ka hall book karo. Delhi NCR me {settings.MaxDeliveryRadiusKm ?? '15'} km tak
              delivery.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={whatsAppLink()}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#1eb855]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                  <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
                  <path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1s-.8 1-1 1.2c-.2.2-.4.3-.7.1a8.3 8.3 0 0 1-2.4-1.5 9.2 9.2 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.6-.7c.2-.2.2-.4.3-.6s0-.4-.1-.6l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.1.2 2.1 3.3 5.1 4.5 1.8.7 2.5.8 3.4.6.5-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.5-.3z" />
                </svg>
                WhatsApp support
              </a>

              {settings.SupportPhone && (
                <a
                  href={`tel:${settings.SupportPhone}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3.5 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                >
                  {settings.SupportPhone}
                </a>
              )}
            </div>
          </div>

          {/* ---------------- link columns ---------------- */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold tracking-wide text-ink-900 uppercase">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.to + l.label}>
                    <Link to={l.to} className="text-sm text-ink-500 transition hover:text-brand-700">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ---------------- bottom strip ---------------- */}
        <div className="mt-10 flex flex-col gap-3 border-t border-ink-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-400">
            &copy; {year} {settings.SiteName ?? 'FoodMitra'}. Ye ek learning/demo project hai -
            restaurant names aur reviews fictional hain.
          </p>

          <p className="text-xs text-ink-400">
            React + TypeScript + Tailwind &middot; .NET Core API &middot; SQL Server
          </p>
        </div>
      </div>
    </footer>
  );
}
