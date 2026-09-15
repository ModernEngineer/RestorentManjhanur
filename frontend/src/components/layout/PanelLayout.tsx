import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

/* ============================================================
   Admin aur Employee panel ka shared shell:
   left sidebar + top bar + content area.
   ============================================================ */

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: 'M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z', end: true },
  { to: '/admin/restaurants', label: 'Restaurants', icon: 'M4 3v8a4 4 0 0 0 3 3.9V21h2v-6.1A4 4 0 0 0 12 11V3h-2v6H9V3H7v6H6V3H4Zm14 0c-2 0-3 2.5-3 6 0 2.8 1 4.7 2 5.3V21h2V14.3c1-.6 2-2.5 2-5.3 0-3.5-1-6-3-6Z' },
  { to: '/admin/menu', label: 'Menu & images', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/admin/orders', label: 'Orders', icon: 'M9 5h6a2 2 0 0 1 2 2v12l-5-3-5 3V7a2 2 0 0 1 2-2Z' },
  { to: '/admin/bookings', label: 'Bookings', icon: 'M8 2v4m8-4v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z' },
  { to: '/admin/coupons', label: 'Coupons & discounts', icon: 'M20 12a2 2 0 0 1 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4a2 2 0 0 1 0 4v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 1-2-2Z' },
  { to: '/admin/employees', label: 'Employees', icon: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.9' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z' },
  { to: '/admin/testimonials', label: 'Happy customers', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z' },
  { to: '/admin/payments', label: 'Payments', icon: 'M2 8h20M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z' },
  { to: '/admin/settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.2-1.3L14.9 2H9.1l-.4 2.4a8 8 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.2 1.3l.4 2.4h5.8l.4-2.4a8 8 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z' },
];

const EMPLOYEE_NAV: NavItem[] = [
  { to: '/employee', label: 'Dashboard', icon: 'M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z', end: true },
  { to: '/employee/orders', label: 'Orders', icon: 'M9 5h6a2 2 0 0 1 2 2v12l-5-3-5 3V7a2 2 0 0 1 2-2Z' },
  { to: '/employee/menu', label: 'Menu & images', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/employee/bookings', label: 'Bookings', icon: 'M8 2v4m8-4v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z' },
  { to: '/employee/deliveries', label: 'My deliveries', icon: 'M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 18.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm15 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z' },
];

export default function PanelLayout({ variant }: { variant: 'admin' | 'employee' }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = variant === 'admin' ? ADMIN_NAV : EMPLOYEE_NAV;
  const title = variant === 'admin' ? 'Admin panel' : 'Employee panel';

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out.');
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* ================== sidebar ================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-ink-100 bg-white transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 px-4">
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            <span className="text-ink-900">food</span>
            <span className="text-brand-600">mitra</span>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="px-4 pt-4 pb-2 text-[11px] font-bold tracking-wider text-ink-400 uppercase">
          {title}
        </p>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5 shrink-0">
                <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-ink-100 p-3">
          <div className="mb-2 flex items-center gap-2.5 px-1">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">{user?.fullName}</p>
              <p className="truncate text-xs text-ink-500">{user?.role}</p>
            </div>
          </div>

          <Link to="/" className="side-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
              <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10Z" strokeLinecap="round" />
            </svg>
            Go to website
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="side-link w-full cursor-pointer text-brand-700 hover:bg-brand-50 hover:text-brand-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-ink-900/50 lg:hidden"
          aria-label="Close sidebar"
          tabIndex={-1}
        />
      )}

      {/* ================== content ================== */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="cursor-pointer rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
            aria-label="Menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>

          <p className="text-sm font-semibold text-ink-700">{title}</p>

          <span className="ml-auto rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-600/20">
            {user?.role}
          </span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
