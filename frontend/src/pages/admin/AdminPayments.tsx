import { useMemo, useState } from 'react';
import { adminApi } from '@/api/endpoints';
import {
  Badge, EmptyState, ErrorBanner, Pagination, RowsSkeleton, StatTile, StatusBadge,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

export default function AdminPayments() {
  usePageTitle('Payments');

  const { currency } = useLocationCtx();

  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);

  const payments = useAsync(
    () =>
      adminApi.payments({
        status: status || undefined,
        fromDate,
        toDate,
        pageNumber: page,
        pageSize: 25,
      }),
    [status, fromDate, toDate, page],
  );

  /* is page ke rows ka quick summary */
  const summary = useMemo(() => {
    const items = payments.data?.items ?? [];
    return {
      paid: items.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0),
      failed: items.filter((p) => p.status === 'FAILED').length,
      refunded: items.filter((p) => p.status === 'REFUNDED').reduce((s, p) => s + p.amount, 0),
      pending: items.filter((p) => p.status === 'CREATED').length,
    };
  }, [payments.data]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Payments</h1>
        <p className="text-sm text-ink-500">
          Food orders aur hall booking advance - dono ke transactions.
        </p>
      </div>

      {/* ---------------- filters ---------------- */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-36">
          <label htmlFor="pm-from" className="label">From</label>
          <input
            id="pm-from"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="input"
          />
        </div>

        <div className="min-w-36">
          <label htmlFor="pm-to" className="label">To</label>
          <input
            id="pm-to"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="input"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {['', 'PAID', 'CREATED', 'FAILED', 'REFUNDED'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`chip ${status === s ? 'chip-active' : ''}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- page summary ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Is page par received" value={currency(summary.paid)} tone="green" />
        <StatTile label="Refunded" value={currency(summary.refunded)} tone="gray" />
        <StatTile label="Failed" value={summary.failed} tone={summary.failed > 0 ? 'red' : 'gray'} />
        <StatTile label="Pending" value={summary.pending} tone={summary.pending > 0 ? 'amber' : 'gray'} />
      </div>

      {/* ---------------- table ---------------- */}
      {payments.error ? (
        <ErrorBanner message={payments.error} onRetry={payments.reload} />
      ) : payments.isLoading ? (
        <RowsSkeleton rows={6} />
      ) : (payments.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No payments found" description="Try changing the date range or status filter." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>For</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Gateway</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.data!.items.map((p) => (
                    <tr key={p.paymentId}>
                      <td>
                        <p className="font-mono text-[11px] break-all text-ink-600">{p.paymentRef}</p>
                        {p.gatewayPaymentId && (
                          <p className="font-mono text-[10px] break-all text-ink-400">{p.gatewayPaymentId}</p>
                        )}
                      </td>

                      <td>
                        <p className="text-sm font-medium text-ink-800">{p.customerName}</p>
                        <p className="max-w-40 truncate text-xs text-ink-400">{p.customerEmail}</p>
                      </td>

                      <td className="text-xs">
                        <Badge tone={p.purposeType === 'HALL' ? 'purple' : 'blue'}>{p.purposeType}</Badge>
                        <p className="mt-1 font-mono text-[11px] text-ink-500">
                          {p.orderNumber ?? p.hallBookingNumber ?? '-'}
                        </p>
                      </td>

                      <td className="text-sm font-bold">{currency(p.amount)}</td>
                      <td className="text-xs">{p.method ?? '-'}</td>
                      <td className="text-xs">{p.gatewayName}</td>

                      <td>
                        <StatusBadge status={p.status} />
                        {p.failureReason && (
                          <p className="mt-1 max-w-40 text-[11px] text-brand-700">{p.failureReason}</p>
                        )}
                      </td>

                      <td className="text-xs text-ink-400">
                        {new Date(p.completedAt ?? p.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            pageNumber={payments.data!.pageNumber}
            totalPages={payments.data!.totalPages}
            totalCount={payments.data!.totalCount}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
