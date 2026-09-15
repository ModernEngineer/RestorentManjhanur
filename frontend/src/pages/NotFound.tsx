import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/useAsync';

export default function NotFound() {
  usePageTitle('Page not found');

  return (
    <div className="container-app flex min-h-[70vh] flex-col items-center justify-center gap-5 py-16 text-center">
      <p className="text-7xl font-extrabold text-brand-200">404</p>

      <div>
        <h1 className="text-2xl font-bold text-ink-900">This page does not exist</h1>
        <p className="mt-1.5 max-w-md text-sm text-ink-500">
          The link is wrong or the page was removed. Start again from home.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary">
          Go to home
        </Link>
        <Link to="/restaurants" className="btn-outline">
          Browse restaurants
        </Link>
      </div>
    </div>
  );
}
