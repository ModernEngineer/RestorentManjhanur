import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';

/**
 * Route guard. `roles` do to sirf wahi roles andar aa sakte hain,
 * warna 403 wala message dikhta hai (chup-chaap redirect nahi -
 * user ko pata chalna chahiye ki access nahi hai).
 */
export default function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // login ke baad wapas isi page par bhejne ke liye path yaad rakho
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && role && !roles.includes(role)) {
    return <Forbidden role={role} needed={roles} />;
  }

  return <Outlet />;
}

function Forbidden({ role, needed }: { role: Role; needed: Role[] }) {
  return (
    <div className="container-app flex min-h-[70vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-8">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
        </svg>
      </span>

      <div>
        <h1 className="text-xl font-bold text-ink-900">This page is not for you</h1>
        <p className="mt-1.5 max-w-md text-sm text-ink-500">
          This page needs <strong>{needed.join(' ya ')}</strong> role chahiye. Aap abhi{' '}
          <strong>{role}</strong> right now.
        </p>
      </div>

      <a href="/" className="btn-primary">
        Go to home
      </a>
    </div>
  );
}
