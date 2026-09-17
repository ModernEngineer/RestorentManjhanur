import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import logo from '@/assets/Tyke (1).png';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { DELIVERY_AREAS, useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';

const NAV_LINKS = [
  { to: '/restaurants', label: 'Order online' },
  { to: '/dining', label: 'Dining out' },
  { to: '/party-halls', label: 'Party halls' },
  { to: '/offers', label: 'Offers' },
];

export default function Navbar({ onCartClick }: { onCartClick: () => void }) {
  const { user, isAuthenticated, isAdmin, isEmployee, logout } = useAuth();
  const { itemCount } = useCart();
  const { location: loc, setPreset, useMyLocation, isLocating } = useLocationCtx();
  const toast = useToast();
  const navigate = useNavigate();
  const routeLocation = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [locMenu, setLocMenu] = useState(false);
  const [query, setQuery] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  /* home page par navbar transparent se solid hota hai */
  const isHome = routeLocation.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* route change par menus band */
  useEffect(() => {
    setMobileOpen(false);
    setUserMenu(false);
    setLocMenu(false);
  }, [routeLocation.pathname]);

  /* bahar click karne par dropdown band */
  useEffect(() => {
    if (!userMenu && !locMenu) return;

    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenu(false);
        setLocMenu(false);
      }
    };

    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenu, locMenu]);

  const solid = !isHome || scrolled;

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (loc.city) params.set('city', loc.city);
    navigate(`/restaurants?${params.toString()}`);
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out. See you again!');
    navigate('/');
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? 'border-b border-ink-100 bg-white shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="container-app flex h-16 items-center gap-3">
        {/* ---------------- logo ---------------- */}
        <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-extrabold tracking-tight">
          <img src={logo} alt="Food Mail logo" className="h-9 w-9 object-contain drop-shadow-sm" />
          <span className={solid ? 'text-ink-900' : 'text-white drop-shadow'}>
            Food <span className="text-brand-600">Mail</span>
          </span>
        </Link>

        {/* ---------------- location + search (desktop) ---------------- */}
        {solid && (
          <div ref={menuRef} className="hidden flex-1 items-center gap-2 lg:flex">
            {/* location */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setLocMenu((v) => !v); setUserMenu(false); }}
                className="flex max-w-56 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-ink-50"
                aria-expanded={locMenu}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0 text-brand-600">
                  <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" strokeLinecap="round" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span className="truncate font-medium text-ink-700">{loc.label}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`size-3.5 shrink-0 text-ink-400 transition ${locMenu ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" />
                </svg>
              </button>

              {locMenu && (
                <div className="absolute top-full left-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-xl border border-ink-100 bg-white p-2 shadow-pop">
                  <button
                    type="button"
                    onClick={() => { useMyLocation(); setLocMenu(false); }}
                    className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                  >
                    {isLocating ? 'Searching...' : 'My current location'}
                  </button>
                  <div className="my-1 border-t border-ink-100" />
                  {DELIVERY_AREAS.map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { setPreset(i); setLocMenu(false); }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-ink-50 ${
                        loc.label === p.label ? 'bg-ink-50 font-semibold text-ink-900' : 'text-ink-600'
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

            <span className="h-6 w-px bg-ink-200" aria-hidden="true" />

            {/* search */}
            <form onSubmit={onSearch} className="flex flex-1 items-center gap-2 rounded-lg bg-ink-50 px-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0 text-ink-400">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a restaurant, cuisine or dish"
                className="w-full bg-transparent py-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
                aria-label="Search"
              />
            </form>
          </div>
        )}

        {!solid && <div className="flex-1" />}

        {/* ---------------- nav links (desktop) ---------------- */}
        <nav className="hidden items-center gap-1 xl:flex">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  solid
                    ? isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* ---------------- cart ---------------- */}
        <button
          type="button"
          onClick={onCartClick}
          className={`relative shrink-0 cursor-pointer rounded-lg p-2.5 transition ${
            solid ? 'text-ink-600 hover:bg-ink-50' : 'text-white hover:bg-white/10'
          }`}
          aria-label={`Cart - ${itemCount} items`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
            <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13 5.4 5M7 13l-2 5h14" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="20" r="1.4" fill="currentColor" />
            <circle cx="18" cy="20" r="1.4" fill="currentColor" />
          </svg>

          {itemCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>

        {/* ---------------- auth ---------------- */}
        {isAuthenticated ? (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setUserMenu((v) => !v); setLocMenu(false); }}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                solid ? 'hover:bg-ink-50' : 'hover:bg-white/10'
              }`}
              aria-expanded={userMenu}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
              </span>
              <span className={`hidden max-w-24 truncate text-sm font-medium sm:block ${solid ? 'text-ink-700' : 'text-white'}`}>
                {user?.fullName?.split(' ')[0]}
              </span>
            </button>

            {userMenu && (
              <div className="absolute top-full right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop">
                <div className="border-b border-ink-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-ink-900">{user?.fullName}</p>
                  <p className="truncate text-xs text-ink-500">{user?.email}</p>
                  <span className="mt-1.5 inline-block rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-600 uppercase">
                    {user?.role}
                  </span>
                </div>

                <div className="p-1.5">
                  {isAdmin && (
                    <MenuItem to="/admin" label="Admin panel" onClick={() => setUserMenu(false)} />
                  )}
                  {isEmployee && (
                    <MenuItem to="/employee" label="Employee panel" onClick={() => setUserMenu(false)} />
                  )}

                  <MenuItem to="/my-orders" label="My orders" onClick={() => setUserMenu(false)} />
                  <MenuItem to="/my-bookings" label="My bookings" onClick={() => setUserMenu(false)} />
                  <MenuItem to="/profile" label="Profile aur address" onClick={() => setUserMenu(false)} />
                </div>

                <div className="border-t border-ink-100 p-1.5">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Link to="/login" className={solid ? 'btn-ghost' : 'btn-ghost !text-white hover:!bg-white/10'}>
              Login
            </Link>
            <Link to="/register" className="btn-primary">
              Sign up
            </Link>
          </div>
        )}

        {/* ---------------- mobile toggle ---------------- */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className={`shrink-0 cursor-pointer rounded-lg p-2.5 transition xl:hidden ${
            solid ? 'text-ink-600 hover:bg-ink-50' : 'text-white hover:bg-white/10'
          }`}
          aria-label="Menu"
          aria-expanded={mobileOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
            {mobileOpen ? (
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* ---------------- mobile drawer ---------------- */}
      {mobileOpen && (
        <div className="animate-fade-in border-t border-ink-100 bg-white px-4 py-3 shadow-lg xl:hidden">
          <form onSubmit={onSearch} className="mb-3 flex items-center gap-2 rounded-lg bg-ink-50 px-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ink-400">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to eat?"
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </form>

          <nav className="space-y-0.5">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          {!isAuthenticated && (
            <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
              <Link to="/login" className="btn-outline flex-1">
                Login
              </Link>
              <Link to="/register" className="btn-primary flex-1">
                Sign up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function MenuItem({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
    >
      {label}
    </Link>
  );
}
