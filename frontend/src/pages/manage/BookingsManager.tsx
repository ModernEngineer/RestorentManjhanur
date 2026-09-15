import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { manageApi } from '@/api/endpoints';
import ImagePicker from '@/components/ImagePicker';
import {
  Badge, EmptyState, ErrorBanner, Modal, Pagination, RowsSkeleton, SafeImage,
  Spinner, StatusBadge,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, useDebounced, usePageTitle } from '@/hooks/useAsync';
import type { Hall } from '@/types';
import { scopeOptions, useRestaurantScope } from './useRestaurantScope';

type Tab = 'tables' | 'halls' | 'hallMaster' | 'tableMaster';

const TABLE_STEPS: Record<string, { status: string; label: string; tone: string }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirm', tone: 'btn-success' },
    { status: 'REJECTED', label: 'Reject', tone: 'btn-danger' },
  ],
  CONFIRMED: [
    { status: 'SEATED', label: 'Guests arrived', tone: 'btn-primary' },
    { status: 'CANCELLED', label: 'Cancel', tone: 'btn-ghost !text-brand-700' },
  ],
  SEATED: [{ status: 'COMPLETED', label: 'Mark complete', tone: 'btn-success' }],
};

const HALL_STEPS: Record<string, { status: string; label: string; tone: string }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirm', tone: 'btn-success' },
    { status: 'REJECTED', label: 'Reject', tone: 'btn-danger' },
  ],
  CONFIRMED: [
    { status: 'COMPLETED', label: 'Event completed', tone: 'btn-success' },
    { status: 'CANCELLED', label: 'Cancel', tone: 'btn-ghost !text-brand-700' },
  ],
};

export default function BookingsManager() {
  usePageTitle('Booking management');

  const [params] = useSearchParams();
  const { currency } = useLocationCtx();
  const toast = useToast();
  const scope = useRestaurantScope();

  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'tables');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [hallForm, setHallForm] = useState<Hall | null>(null);
  const [showHallForm, setShowHallForm] = useState(false);
  const [hallImage, setHallImage] = useState<Hall | null>(null);
  const [showTableForm, setShowTableForm] = useState(false);

  const canManage = scope.selected?.canManageBooking ?? false;

  /* ---------------- data ---------------- */
  const tableBookings = useAsync(
    () =>
      tab === 'tables' && scope.selectedId
        ? manageApi.tableBookings({
            restaurantId: scope.selectedId,
            status: status || undefined,
            search: debouncedSearch || undefined,
            pageNumber: page,
            pageSize: 20,
          })
        : Promise.resolve(null),
    [tab, scope.selectedId, status, debouncedSearch, page],
  );

  const hallBookings = useAsync(
    () =>
      tab === 'halls' && scope.selectedId
        ? manageApi.hallBookings({
            restaurantId: scope.selectedId,
            status: status || undefined,
            search: debouncedSearch || undefined,
            pageNumber: page,
            pageSize: 20,
          })
        : Promise.resolve(null),
    [tab, scope.selectedId, status, debouncedSearch, page],
  );

  const halls = useAsync(
    () =>
      tab === 'hallMaster' && scope.selectedId
        ? manageApi.halls(scope.selectedId)
        : Promise.resolve(null),
    [tab, scope.selectedId],
  );

  const tables = useAsync(
    () =>
      tab === 'tableMaster' && scope.selectedId
        ? manageApi.tables(scope.selectedId)
        : Promise.resolve(null),
    [tab, scope.selectedId],
  );

  /* ---------------- actions ---------------- */
  const updateTableStatus = async (bookingId: number, next: string) => {
    setBusyId(bookingId);
    try {
      await manageApi.updateTableBookingStatus(bookingId, next);
      toast.success(`Booking ${next}`);
      tableBookings.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  const updateHallStatus = async (bookingId: number, next: string) => {
    setBusyId(bookingId);
    try {
      await manageApi.updateHallBookingStatus(bookingId, next);
      toast.success(`Booking ${next}`);
      hallBookings.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  if (scope.isLoading) return <RowsSkeleton rows={4} />;
  if (scope.error) return <ErrorBanner message={scope.error} />;

  if (scope.restaurants.length === 0) {
    return (
      <EmptyState
        title="No restaurant assigned"
        description="Admin se restaurant assign karwao, tab bookings dikhengi."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Booking management</h1>
        <p className="text-sm text-ink-500">
          Table reservations, party hall bookings aur unka master data.
        </p>
      </div>

      {/* ---------------- scope ---------------- */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-56 flex-1">
          <label htmlFor="bm-rest" className="label">
            Restaurant
          </label>
          <select
            id="bm-rest"
            value={scope.selectedId ?? ''}
            onChange={(e) => {
              scope.setSelectedId(Number(e.target.value));
              setPage(1);
            }}
            className="select"
          >
            {scopeOptions(scope.restaurants).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {(tab === 'tables' || tab === 'halls') && (
          <div className="min-w-48 flex-1">
            <label htmlFor="bm-search" className="label">
              Dhoondo
            </label>
            <input
              id="bm-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Booking number, naam ya phone"
              className="input"
            />
          </div>
        )}
      </div>

      {/* ---------------- tabs ---------------- */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(
          [
            { key: 'tables', label: 'Table bookings' },
            { key: 'halls', label: 'Hall bookings' },
            { key: 'hallMaster', label: 'Halls (master)' },
            { key: 'tableMaster', label: 'Tables (master)' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setStatus('');
              setPage(1);
            }}
            className={`chip ${tab === t.key ? 'chip-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!canManage && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {scope.selected?.name} ki bookings manage karne ki permission nahi hai
          </p>
          <p className="mt-0.5 text-sm text-amber-800">Admin se "Can manage booking" permission maango.</p>
        </div>
      )}

      {/* ---------------- status filter ---------------- */}
      {(tab === 'tables' || tab === 'halls') && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['', 'PENDING', 'CONFIRMED', ...(tab === 'tables' ? ['SEATED'] : []), 'COMPLETED', 'CANCELLED', 'REJECTED'].map(
            (s) => (
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
            ),
          )}
        </div>
      )}

      {/* ==================== TABLE BOOKINGS ==================== */}
      {tab === 'tables' &&
        (tableBookings.error ? (
          <ErrorBanner message={tableBookings.error} onRetry={tableBookings.reload} />
        ) : tableBookings.isLoading ? (
          <RowsSkeleton rows={4} />
        ) : (tableBookings.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No table bookings" description="No reservations match this filter." />
        ) : (
          <>
            <ul className="space-y-3">
              {tableBookings.data!.items.map((b) => (
                <li key={b.bookingId} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-ink-900">{b.bookingNumber}</p>
                        <StatusBadge status={b.status} />
                        {b.occasion && b.occasion !== 'Casual' && (
                          <Badge tone="purple">{b.occasion}</Badge>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm font-semibold text-ink-800">
                        {b.guestName}
                        <a href={`tel:${b.guestPhone}`} className="ml-2 font-normal text-brand-700 hover:underline">
                          {b.guestPhone}
                        </a>
                      </p>

                      <p className="mt-1 text-sm text-ink-700">
                        {fmtDate(b.bookingDate)} - {b.bookingTime?.slice(0, 5)} - {b.guestCount} guests
                        {b.durationMin ? ` - ${b.durationMin} min` : ''}
                      </p>

                      <p className="mt-0.5 text-xs text-ink-500">
                        {b.tableNumber ? `Table ${b.tableNumber} (${b.tableLocation}, ${b.seatCapacity} seats)` : 'No table assigned yet'}
                      </p>

                      {b.specialRequest && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                          {b.specialRequest}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right text-xs text-ink-400">
                      <p>Booked by {b.customerName}</p>
                      <p>
                        {new Date(b.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      {b.handledBy && <p>Handled: {b.handledBy}</p>}
                    </div>
                  </div>

                  {canManage && TABLE_STEPS[b.status] && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                      {TABLE_STEPS[b.status].map((s) => (
                        <button
                          key={s.status}
                          type="button"
                          onClick={() => updateTableStatus(b.bookingId, s.status)}
                          disabled={busyId === b.bookingId}
                          className={`${s.tone} btn-sm`}
                        >
                          {busyId === b.bookingId && <Spinner className="size-3.5" />}
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <Pagination
              pageNumber={tableBookings.data!.pageNumber}
              totalPages={tableBookings.data!.totalPages}
              totalCount={tableBookings.data!.totalCount}
              onChange={setPage}
            />
          </>
        ))}

      {/* ==================== HALL BOOKINGS ==================== */}
      {tab === 'halls' &&
        (hallBookings.error ? (
          <ErrorBanner message={hallBookings.error} onRetry={hallBookings.reload} />
        ) : hallBookings.isLoading ? (
          <RowsSkeleton rows={4} />
        ) : (hallBookings.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No hall bookings" description="No event bookings match this filter." />
        ) : (
          <>
            <ul className="space-y-3">
              {hallBookings.data!.items.map((b) => (
                <li key={b.bookingId} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-ink-900">{b.bookingNumber}</p>
                        <Badge tone="purple">{b.eventType}</Badge>
                        <StatusBadge status={b.status} />
                        <StatusBadge status={b.paymentStatus} />
                      </div>

                      <p className="mt-1.5 text-sm font-semibold text-ink-800">
                        {b.hallName} - {b.contactName}
                        <a href={`tel:${b.contactPhone}`} className="ml-2 font-normal text-brand-700 hover:underline">
                          {b.contactPhone}
                        </a>
                      </p>

                      <p className="mt-1 text-sm text-ink-700">
                        {fmtDate(b.eventDate)} - {b.startTime?.slice(0, 5)} to {b.endTime?.slice(0, 5)} -{' '}
                        {b.guestCount} guests
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {b.decorationTheme && <Badge tone="amber">Decor: {b.decorationTheme}</Badge>}
                        {b.cakeRequired && (
                          <Badge tone="blue">
                            Cake: {b.cakeFlavour} {b.cakeWeightKg}kg
                          </Badge>
                        )}
                        {b.menuPreference && <Badge>{b.menuPreference}</Badge>}
                        {b.couponCode && <Badge tone="green">{b.couponCode}</Badge>}
                      </div>

                      {b.specialRequest && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                          {b.specialRequest}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-ink-900">{currency(b.totalAmount)}</p>
                      <p className="text-xs text-ink-400">
                        Advance: {currency(b.advanceAmount)}
                      </p>
                      <p className="mt-1 text-xs text-ink-400">
                        Rent {currency(b.baseRent)} + plates {currency(b.plateAmount)}
                      </p>
                      {b.handledBy && <p className="mt-1 text-xs text-ink-400">By {b.handledBy}</p>}
                    </div>
                  </div>

                  {canManage && HALL_STEPS[b.status] && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                      {HALL_STEPS[b.status].map((s) => (
                        <button
                          key={s.status}
                          type="button"
                          onClick={() => updateHallStatus(b.bookingId, s.status)}
                          disabled={busyId === b.bookingId}
                          className={`${s.tone} btn-sm`}
                        >
                          {busyId === b.bookingId && <Spinner className="size-3.5" />}
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <Pagination
              pageNumber={hallBookings.data!.pageNumber}
              totalPages={hallBookings.data!.totalPages}
              totalCount={hallBookings.data!.totalCount}
              onChange={setPage}
            />
          </>
        ))}

      {/* ==================== HALL MASTER ==================== */}
      {tab === 'hallMaster' && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setHallForm(null);
                setShowHallForm(true);
              }}
              disabled={!canManage}
              className="btn-primary"
            >
              + New hall
            </button>
          </div>

          {halls.error ? (
            <ErrorBanner message={halls.error} onRetry={halls.reload} />
          ) : halls.isLoading ? (
            <RowsSkeleton rows={3} />
          ) : (halls.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No halls yet"
              description="Add your first hall to start taking party hall bookings."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {halls.data!.map((h) => (
                <div key={h.hallId} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setHallImage(h)}
                    disabled={!canManage}
                    className="group relative block h-36 w-full cursor-pointer bg-ink-100"
                    title="Change image"
                  >
                    <SafeImage src={h.imageUrl} alt={h.name} className="size-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-ink-900/60 opacity-0 transition group-hover:opacity-100">
                      <span className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-ink-800">
                        Change image
                      </span>
                    </span>
                  </button>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-semibold text-ink-900">{h.name}</h3>
                      <Badge tone={h.isActive ? 'green' : 'gray'}>{h.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>

                    <p className="mt-1 text-xs text-ink-500">
                      {h.minCapacity}-{h.maxCapacity} guests
                    </p>

                    <p className="mt-1.5 text-sm">
                      <span className="font-bold text-ink-900">{currency(h.pricePerPlate)}</span>
                      <span className="text-xs text-ink-500">/plate + {currency(h.baseRent)} rent</span>
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {h.hasAC && <Badge tone="blue">AC</Badge>}
                      {h.hasDJ && <Badge tone="purple">DJ</Badge>}
                      {h.hasParking && <Badge>Parking</Badge>}
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setHallForm(h);
                          setShowHallForm(true);
                        }}
                        disabled={!canManage}
                        className="btn-outline btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setHallImage(h)}
                        disabled={!canManage}
                        className="btn-outline btn-sm"
                      >
                        Image
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ==================== TABLE MASTER ==================== */}
      {tab === 'tableMaster' && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowTableForm(true)}
              disabled={!canManage}
              className="btn-primary"
            >
              + New table
            </button>
          </div>

          {tables.error ? (
            <ErrorBanner message={tables.error} onRetry={tables.reload} />
          ) : tables.isLoading ? (
            <RowsSkeleton rows={3} />
          ) : (tables.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No tables yet"
              description="Add tables first to start taking table bookings."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th>Seats</th>
                      <th>Location</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.data!.map((t) => (
                      <tr key={t.tableId}>
                        <td className="font-semibold">{t.tableNumber}</td>
                        <td>{t.seatCapacity}</td>
                        <td>{t.location}</td>
                        <td>
                          <Badge tone={t.isActive ? 'green' : 'gray'}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== modals ==================== */}
      {showHallForm && scope.selectedId && (
        <HallForm
          open={showHallForm}
          onClose={() => {
            setShowHallForm(false);
            setHallForm(null);
          }}
          restaurantId={scope.selectedId}
          existing={hallForm}
          onSaved={() => {
            setShowHallForm(false);
            setHallForm(null);
            halls.reload();
          }}
        />
      )}

      {hallImage && (
        <ImagePicker
          open
          onClose={() => setHallImage(null)}
          title={`${hallImage.name} - change image`}
          currentUrl={hallImage.imageUrl}
          onUpload={async (file) => {
            const res = await manageApi.uploadHallImage(hallImage.hallId, file);
            return res.imageUrl;
          }}
          onSetUrl={async (url) => {
            await manageApi.saveHall({
              hallId: hallImage.hallId,
              restaurantId: hallImage.restaurantId,
              name: hallImage.name,
              description: hallImage.description,
              minCapacity: hallImage.minCapacity,
              maxCapacity: hallImage.maxCapacity,
              pricePerPlate: hallImage.pricePerPlate,
              baseRent: hallImage.baseRent,
              imageUrl: url,
              hasAC: hallImage.hasAC,
              hasParking: hallImage.hasParking,
              hasDJ: hallImage.hasDJ,
              isActive: hallImage.isActive ?? true,
            });
          }}
          onSaved={() => {
            setHallImage(null);
            halls.reload();
          }}
        />
      )}

      {showTableForm && scope.selectedId && (
        <TableForm
          open={showTableForm}
          onClose={() => setShowTableForm(false)}
          restaurantId={scope.selectedId}
          onSaved={() => {
            setShowTableForm(false);
            tables.reload();
          }}
        />
      )}
    </div>
  );
}

/* ================================================================= */

function HallForm({
  open,
  onClose,
  restaurantId,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: number;
  existing: Hall | null;
  onSaved: () => void;
}) {
  const toast = useToast();

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [minCap, setMinCap] = useState(existing?.minCapacity?.toString() ?? '20');
  const [maxCap, setMaxCap] = useState(existing?.maxCapacity?.toString() ?? '100');
  const [plate, setPlate] = useState(existing?.pricePerPlate?.toString() ?? '850');
  const [rent, setRent] = useState(existing?.baseRent?.toString() ?? '8000');
  const [hasAC, setHasAC] = useState(existing?.hasAC ?? true);
  const [hasParking, setHasParking] = useState(existing?.hasParking ?? true);
  const [hasDJ, setHasDJ] = useState(existing?.hasDJ ?? false);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [amenities, setAmenities] = useState(() => {
    if (!existing?.amenitiesJson) return '';
    try {
      const parsed = JSON.parse(existing.amenitiesJson);
      return Array.isArray(parsed) ? parsed.join(', ') : '';
    } catch {
      return '';
    }
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (Number(maxCap) < Number(minCap)) {
      setError('Max capacity cannot be less than min capacity.');
      return;
    }

    setBusy(true);

    try {
      const amenityList = amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      await manageApi.saveHall({
        hallId: existing?.hallId ?? 0,
        restaurantId,
        name: name.trim(),
        description: description.trim() || null,
        minCapacity: Number(minCap),
        maxCapacity: Number(maxCap),
        pricePerPlate: Number(plate),
        baseRent: Number(rent),
        amenitiesJson: amenityList.length > 0 ? JSON.stringify(amenityList) : null,
        hasAC,
        hasParking,
        hasDJ,
        isActive,
      });

      toast.success('Hall saved.');
      onSaved();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
          ? err.detail
          : 'Could not save.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={existing ? `Edit ${existing.name}` : 'New hall'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="hall-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            Hall save karo
          </button>
        </>
      }
    >
      <form id="hall-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="hf-name" className="label">Hall ka naam</label>
          <input
            id="hf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Emerald Hall"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="hf-desc" className="label">Description</label>
          <textarea
            id="hf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input resize-y"
            placeholder="What the hall is like and which events it suits best"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hf-min" className="label">Min guests</label>
            <input
              id="hf-min"
              type="number"
              value={minCap}
              onChange={(e) => setMinCap(e.target.value)}
              required
              min={1}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="hf-max" className="label">Max guests</label>
            <input
              id="hf-max"
              type="number"
              value={maxCap}
              onChange={(e) => setMaxCap(e.target.value)}
              required
              min={1}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="hf-plate" className="label">Price per plate (Rs)</label>
            <input
              id="hf-plate"
              type="number"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              required
              min={0}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="hf-rent" className="label">Hall rent (Rs)</label>
            <input
              id="hf-rent"
              type="number"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              required
              min={0}
              className="input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="hf-amen" className="label">Amenities (comma separated)</label>
          <input
            id="hf-amen"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="AC, Stage, LED Wall, Valet Parking"
            className="input"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              { label: 'AC', value: hasAC, set: setHasAC },
              { label: 'Parking', value: hasParking, set: setHasParking },
              { label: 'DJ', value: hasDJ, set: setHasDJ },
              { label: 'Active', value: isActive, set: setIsActive },
            ] as const
          ).map((f) => (
            <label key={f.label} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={f.value}
                onChange={(e) => f.set(e.target.checked)}
                className="size-4 accent-brand-600"
              />
              <span className="text-sm text-ink-700">{f.label}</span>
            </label>
          ))}
        </div>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}

/* ================================================================= */

function TableForm({
  open,
  onClose,
  restaurantId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [tableNumber, setTableNumber] = useState('');
  const [seats, setSeats] = useState('4');
  const [location, setLocation] = useState('Indoor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const result = await manageApi.saveTable({
        restaurantId,
        tableNumber: tableNumber.trim(),
        seatCapacity: Number(seats),
        location,
        isActive: true,
      });

      if (result.tableId <= 0) {
        setError(result.message);
        return;
      }

      toast.success('Table added.');
      onSaved();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
          ? err.detail
          : 'Could not save.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New table"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="table-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            Table add karo
          </button>
        </>
      }
    >
      <form id="table-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="tf-num" className="label">Table number</label>
          <input
            id="tf-num"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            required
            maxLength={20}
            placeholder="e.g. T13"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="tf-seats" className="label">Kitne seats</label>
          <input
            id="tf-seats"
            type="number"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            required
            min={1}
            max={50}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="tf-loc" className="label">Location</label>
          <select id="tf-loc" value={location} onChange={(e) => setLocation(e.target.value)} className="select">
            <option value="Indoor">Indoor</option>
            <option value="Outdoor">Outdoor</option>
            <option value="Rooftop">Rooftop</option>
          </select>
        </div>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
