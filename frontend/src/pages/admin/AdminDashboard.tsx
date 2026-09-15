import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { adminApi } from '@/api/endpoints';
import {
  ErrorBanner, RowsSkeleton, SafeImage, StatTile, StatusBadge,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

/* chart colors - brand palette se */
const STATUS_COLORS: Record<string, string> = {
  PLACED: '#f59e0b',
  CONFIRMED: '#8b5cf6',
  PREPARING: '#3b82f6',
  OUT_FOR_DELIVERY: '#0ea5e9',
  DELIVERED: '#267e3e',
  CANCELLED: '#e23744',
  REJECTED: '#9d1d27',
};

const RANGES = [
  { label: 'Last 7 din', days: 7 },
  { label: 'Last 30 din', days: 30 },
  { label: 'Last 90 din', days: 90 },
];

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  usePageTitle('Admin dashboard');

  const { currency } = useLocationCtx();
  const [days, setDays] = useState(30);

  const { data, isLoading, error, reload } = useAsync(
    () => adminApi.dashboard({ fromDate: isoDaysAgo(days), toDate: new Date().toISOString().slice(0, 10) }),
    [days],
  );

  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-72" />
        <RowsSkeleton rows={5} />
      </div>
    );
  }

  const { kpi, revenueTrend, topRestaurants, orderStatusBreakdown, topDishes, recentOrders, bookingsSummary } = data;

  const trendData = revenueTrend.map((p) => ({
    date: new Date(p.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    revenue: Number(p.revenue),
    orders: p.orderCount,
  }));

  const pieData = orderStatusBreakdown.map((s) => ({
    name: s.status.replaceAll('_', ' '),
    value: s.cnt,
    key: s.status,
  }));

  return (
    <div className="space-y-6">
      {/* ---------------- header ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-500">Poore system ka overview</p>
        </div>

        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={`chip ${days === r.days ? 'chip-active' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- KPI tiles ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Aaj ka revenue"
          value={currency(kpi.todayRevenue)}
          sub={`${kpi.todayOrders} orders aaj`}
          tone="green"
          icon={<Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />}
        />
        <StatTile
          label="Total revenue"
          value={currency(kpi.totalRevenue)}
          sub={`${kpi.totalOrders} orders total`}
          tone="blue"
          icon={<Icon d="M3 3v18h18M7 16l4-6 4 3 4-7" />}
        />
        <StatTile
          label="Pending orders"
          value={kpi.pendingOrders}
          sub="Needs action"
          tone={kpi.pendingOrders > 0 ? 'amber' : 'gray'}
          icon={<Icon d="M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />}
        />
        <StatTile
          label="Average rating"
          value={kpi.avgRating > 0 ? kpi.avgRating.toFixed(2) : '--'}
          sub={`${kpi.activeRestaurants} active restaurants`}
          tone="purple"
          icon={<Icon d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />}
        />

        <StatTile label="Customers" value={kpi.totalCustomers} tone="gray"
          icon={<Icon d="M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />} />
        <StatTile label="Active employees" value={kpi.activeEmployees} tone="gray"
          icon={<Icon d="M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.9" />} />
        <StatTile label="Menu items" value={kpi.totalMenuItems} tone="gray"
          icon={<Icon d="M4 6h16M4 12h16M4 18h10" />} />
        <StatTile label="Live coupons" value={kpi.liveCoupons} tone="green"
          icon={<Icon d="M20 12a2 2 0 0 1 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4a2 2 0 0 1 0 4v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 1-2-2Z" />} />
      </div>

      {/* ---------------- action needed ---------------- */}
      {(kpi.pendingTableBookings > 0 || kpi.pendingHallBookings > 0 || kpi.pendingReviews > 0) && (
        <div className="card flex flex-wrap items-center gap-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Ispar dhyan do:</p>

          {kpi.pendingTableBookings > 0 && (
            <Link to="/admin/bookings" className="text-sm font-semibold text-amber-800 underline">
              {kpi.pendingTableBookings} table booking confirm karni hain
            </Link>
          )}

          {kpi.pendingHallBookings > 0 && (
            <Link to="/admin/bookings?tab=halls" className="text-sm font-semibold text-amber-800 underline">
              {kpi.pendingHallBookings} hall booking pending
            </Link>
          )}

          {kpi.pendingReviews > 0 && (
            <Link to="/admin/reviews" className="text-sm font-semibold text-amber-800 underline">
              {kpi.pendingReviews} review moderate karne hain
            </Link>
          )}
        </div>
      )}

      {/* ---------------- charts ---------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* revenue trend */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Revenue trend</h2>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e23744" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e23744" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#eceef0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#8a939f' }}
                  interval="preserveStartEnd"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#8a939f' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #eceef0', fontSize: 12 }}
                  formatter={(value, name) =>
                    name === 'revenue'
                      ? [currency(Number(value)), 'Revenue']
                      : [String(value), 'Orders']
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#e23744"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* status breakdown */}
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Order status</h2>

          {pieData.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-400">No orders in this range</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={STATUS_COLORS[d.key] ?? '#8a939f'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eceef0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* ---------------- bookings summary ---------------- */}
      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-900">Bookings (next 30 days)</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Table bookings" value={bookingsSummary.upcomingTableBookings} />
          <MiniStat label="Hall bookings" value={bookingsSummary.upcomingHallBookings} />
          <MiniStat label="Birthday events" value={bookingsSummary.upcomingBirthdayEvents} />
          <MiniStat label="Hall revenue (upcoming)" value={currency(bookingsSummary.upcomingHallRevenue)} />
          <MiniStat label="Advance collected" value={currency(bookingsSummary.hallAdvanceCollected)} />
        </div>
      </section>

      {/* ---------------- top restaurants + dishes ---------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Top restaurants (revenue)</h2>

          {topRestaurants.filter((r) => r.revenue > 0).length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">No revenue in this range</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topRestaurants.slice(0, 6).map((r) => ({ name: r.name, revenue: Number(r.revenue) }))}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eceef0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8a939f' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: '#4f5661' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #eceef0', fontSize: 12 }}
                    formatter={(v) => [currency(Number(v)), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#e23744" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Top selling dishes</h2>

          {topDishes.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">No sales yet</p>
          ) : (
            <ul className="space-y-3">
              {topDishes.slice(0, 6).map((d, i) => (
                <li key={d.foodItemId} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-sm font-bold text-ink-300">{i + 1}</span>
                  <SafeImage src={d.itemImage} alt={d.itemName} className="size-10 shrink-0 rounded-lg object-cover" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{d.itemName}</p>
                    <p className="truncate text-xs text-ink-500">{d.restaurantName}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-ink-900">{d.qtySold}</p>
                    <p className="text-xs text-ink-400">{currency(d.revenue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- recent orders ---------------- */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">Recent orders</h2>
          <Link to="/admin/orders" className="btn-outline btn-sm">
            All orders
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Restaurant</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-ink-400">
                    No orders yet
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="font-mono text-xs">{o.orderNumber}</td>
                    <td className="font-medium">{o.customerName}</td>
                    <td>{o.restaurantName}</td>
                    <td className="font-semibold">{currency(o.totalAmount)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td className="text-xs text-ink-400">
                      {new Date(o.placedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- */

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-ink-50 px-4 py-3">
      <p className="text-xl font-bold text-ink-900">{value}</p>
      <p className="mt-0.5 text-[11px] tracking-wide text-ink-500 uppercase">{label}</p>
    </div>
  );
}
