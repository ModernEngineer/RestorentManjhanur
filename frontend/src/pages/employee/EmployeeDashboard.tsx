import { Link } from 'react-router-dom';
import { employeeApi } from '@/api/endpoints';
import {
  Badge, EmptyState, ErrorBanner, RowsSkeleton, SafeImage, StatTile, StatusBadge,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLocationCtx } from '@/context/LocationContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

export default function EmployeeDashboard() {
  usePageTitle('Employee dashboard');

  const { user } = useAuth();
  const { currency } = useLocationCtx();

  const { data, isLoading, error, reload } = useAsync(() => employeeApi.dashboard(), []);

  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <RowsSkeleton rows={4} />
      </div>
    );
  }

  const { kpi, restaurants, pendingOrders } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">
          Namaste, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="text-sm text-ink-500">
          Today's summary for your assigned restaurants.
        </p>
      </div>

      {/* ---------------- KPIs ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Aaj ke orders"
          value={kpi.todayOrders}
          sub={currency(kpi.todayRevenue)}
          tone="blue"
          icon={<Icon d="M9 5h6a2 2 0 0 1 2 2v12l-5-3-5 3V7a2 2 0 0 1 2-2Z" />}
        />
        <StatTile
          label="Pending orders"
          value={kpi.pendingOrders}
          sub={kpi.pendingOrders > 0 ? 'Needs action' : 'All clear'}
          tone={kpi.pendingOrders > 0 ? 'amber' : 'green'}
          icon={<Icon d="M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />}
        />
        <StatTile
          label="My active deliveries"
          value={kpi.myActiveDeliveries}
          sub={`${kpi.myDeliveredOrders} delivered total`}
          tone={kpi.myActiveDeliveries > 0 ? 'purple' : 'gray'}
          icon={<Icon d="M1 3h15v13H1zM16 8h4l3 3v5h-7" />}
        />
        <StatTile
          label="Restaurants"
          value={kpi.assignedRestaurants}
          sub="Aapko assigned"
          tone="gray"
          icon={<Icon d="M4 3v8a4 4 0 0 0 3 3.9V21h2v-6.1A4 4 0 0 0 12 11V3" />}
        />
      </div>

      {/* ---------------- pending bookings ---------------- */}
      {(kpi.pendingTableBookings > 0 || kpi.pendingHallBookings > 0) && (
        <div className="card flex flex-wrap items-center gap-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Bookings pending:</p>

          {kpi.pendingTableBookings > 0 && (
            <Link to="/employee/bookings" className="text-sm font-semibold text-amber-800 underline">
              {kpi.pendingTableBookings} table booking
            </Link>
          )}

          {kpi.pendingHallBookings > 0 && (
            <Link to="/employee/bookings?tab=halls" className="text-sm font-semibold text-amber-800 underline">
              {kpi.pendingHallBookings} hall booking
            </Link>
          )}
        </div>
      )}

      {/* ---------------- my restaurants ---------------- */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink-900">My restaurants</h2>

        {restaurants.length === 0 ? (
          <EmptyState
            title="No restaurant assigned"
            description="Ask an admin to assign you a restaurant - only then will orders and menu appear."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              <div key={r.restaurantId} className="card p-4">
                <div className="flex items-start gap-3">
                  <SafeImage
                    src={r.thumbnailUrl}
                    alt={r.name}
                    className="size-12 shrink-0 rounded-xl object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">{r.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {r.locality}, {r.city}
                    </p>
                    <Badge tone="blue">{r.designation}</Badge>
                  </div>
                </div>

                {/* permissions */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.canManageMenu && <Badge tone="green">Menu</Badge>}
                  {r.canManageOrder && <Badge tone="green">Orders</Badge>}
                  {r.canManageBooking && <Badge tone="green">Bookings</Badge>}
                  {!r.canManageMenu && !r.canManageOrder && !r.canManageBooking && (
                    <Badge tone="red">No permissions</Badge>
                  )}
                </div>

                {/* counters */}
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
                  <div>
                    <dt className="text-[11px] text-ink-400">Pending</dt>
                    <dd className={`text-lg font-bold ${r.pendingOrders > 0 ? 'text-amber-600' : 'text-ink-900'}`}>
                      {r.pendingOrders}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-400">Aaj</dt>
                    <dd className="text-lg font-bold text-ink-900">{r.todayOrders}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-400">Out of stock</dt>
                    <dd className={`text-lg font-bold ${r.outOfStockItems > 0 ? 'text-brand-600' : 'text-ink-900'}`}>
                      {r.outOfStockItems}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- pending orders ---------------- */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink-900">Current pending orders</h2>
          <Link to="/employee/orders" className="btn-outline btn-sm">
            All orders
          </Link>
        </div>

        {pendingOrders.length === 0 ? (
          <EmptyState title="No pending orders" description="Everything has been handled." />
        ) : (
          <ul className="space-y-3">
            {pendingOrders.map((o) => (
              <li key={o.orderId} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-ink-900">{o.orderNumber}</p>
                      <StatusBadge status={o.status} />
                      <Badge tone={o.paymentMode === 'COD' ? 'amber' : 'blue'}>{o.paymentMode}</Badge>
                    </div>

                    <p className="mt-1 text-sm font-medium text-ink-800">
                      {o.customerName}
                      {o.customerPhone && (
                        <a href={`tel:${o.customerPhone}`} className="ml-2 text-brand-700 hover:underline">
                          {o.customerPhone}
                        </a>
                      )}
                    </p>

                    <p className="truncate text-xs text-ink-500">{o.restaurantName}</p>
                    <p className="mt-1 text-xs text-ink-400">{o.deliveryAddress}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-ink-900">{currency(o.totalAmount)}</p>
                    <p className="text-xs text-ink-400">
                      {o.distanceKm} km
                      {o.etaMinutes ? ` - ETA ${o.etaMinutes} min` : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-ink-100 pt-3">
                  <Link to="/employee/orders" className="btn-primary btn-sm">
                    Handle order
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
