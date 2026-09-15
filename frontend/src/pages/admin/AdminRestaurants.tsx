import { useState } from 'react';
import { adminApi, restaurantApi } from '@/api/endpoints';
import ImagePicker from '@/components/ImagePicker';
import {
  Badge, EmptyState, ErrorBanner, Modal, Pagination, RatingBadge, RowsSkeleton,
  SafeImage, Spinner,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, useDebounced, usePageTitle } from '@/hooks/useAsync';
import { DELIVERY_AREAS, PRESET_LOCATIONS } from '@/context/LocationContext';
import type { AdminRestaurantRow } from '@/types';

export default function AdminRestaurants() {
  usePageTitle('Restaurants');

  const { currency } = useLocationCtx();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [city, setCity] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<AdminRestaurantRow | null>(null);
  const [imageRow, setImageRow] = useState<AdminRestaurantRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const list = useAsync(
    () =>
      adminApi.restaurants({
        search: debouncedSearch || undefined,
        city: city || undefined,
        isActive: activeFilter === '' ? undefined : activeFilter === 'true',
        pageNumber: page,
        pageSize: 20,
      }),
    [debouncedSearch, city, activeFilter, page],
  );

  const toggleActive = async (r: AdminRestaurantRow) => {
    setBusyId(r.restaurantId);
    try {
      await adminApi.toggleRestaurant(r.restaurantId, !r.isActive);
      toast.success(r.isActive ? `${r.name} has been closed.` : `${r.name} is now live.`);
      list.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Restaurants</h1>
          <p className="text-sm text-ink-500">Add and edit restaurants, and change their images.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditRow(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + New restaurant
        </button>
      </div>

      {/* ---------------- filters ---------------- */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-48 flex-1">
          <label htmlFor="ar-search" className="label">Dhoondo</label>
          <input
            id="ar-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Naam ya locality"
            className="input"
          />
        </div>

        <div className="min-w-40">
          <label htmlFor="ar-city" className="label">City</label>
          <select
            id="ar-city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            className="select"
          >
            <option value="">All cities</option>
            <option value="New Delhi">New Delhi</option>
            <option value="Gurgaon">Gurgaon</option>
            <option value="Noida">Noida</option>
            <option value="Ghaziabad">Ghaziabad</option>
          </select>
        </div>

        <div className="min-w-36">
          <label htmlFor="ar-status" className="label">Status</label>
          <select
            id="ar-status"
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as '' | 'true' | 'false');
              setPage(1);
            }}
            className="select"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* ---------------- table ---------------- */}
      {list.error ? (
        <ErrorBanner message={list.error} onRetry={list.reload} />
      ) : list.isLoading ? (
        <RowsSkeleton rows={6} />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No restaurants found" description="Try changing the filters or add a new one." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Restaurant</th>
                    <th>Locality</th>
                    <th>Cost / Rating</th>
                    <th>Menu</th>
                    <th>Orders</th>
                    <th>Staff</th>
                    <th>Features</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {list.data!.items.map((r) => (
                    <tr key={r.restaurantId} className={r.isActive ? '' : 'opacity-60'}>
                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setImageRow(r)}
                            className="group relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-ink-100"
                            title="Change image"
                          >
                            <SafeImage src={r.thumbnailUrl} alt={r.name} className="size-full object-cover" />
                            <span className="absolute inset-0 grid place-items-center bg-ink-900/60 opacity-0 transition group-hover:opacity-100">
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="size-4">
                                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </button>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink-900">{r.name}</p>
                            <p className="truncate font-mono text-[11px] text-ink-400">{r.slug}</p>
                          </div>
                        </div>
                      </td>

                      <td className="text-xs">
                        {r.locality}
                        <br />
                        <span className="text-ink-400">{r.city}</span>
                      </td>

                      <td>
                        <p className="text-sm font-semibold">{currency(r.costForTwo)}</p>
                        <RatingBadge value={r.rating} reviews={r.totalReviews} size="sm" />
                      </td>

                      <td className="text-sm">{r.menuItemCount}</td>
                      <td className="text-sm">{r.orderCount}</td>
                      <td className="text-sm">{r.employeeCount}</td>

                      <td>
                        <div className="flex flex-wrap gap-1">
                          {r.isPromoted && <Badge tone="purple">Promoted</Badge>}
                          {r.hasTableBooking && <Badge tone="blue">Table</Badge>}
                          {r.hasHallBooking && <Badge tone="amber">Hall</Badge>}
                          <Badge>{r.deliveryRadiusKm} km</Badge>
                        </div>
                      </td>

                      <td>
                        <Badge tone={r.isActive ? 'green' : 'red'}>
                          {r.isActive ? 'Live' : 'Closed'}
                        </Badge>
                      </td>

                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setImageRow(r)}
                            className="btn-outline btn-sm"
                          >
                            Image
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditRow(r);
                              setShowForm(true);
                            }}
                            className="btn-outline btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(r)}
                            disabled={busyId === r.restaurantId}
                            className={`btn-sm ${r.isActive ? 'btn-ghost !text-brand-700' : 'btn-success'}`}
                          >
                            {busyId === r.restaurantId && <Spinner className="size-3.5" />}
                            {r.isActive ? 'Close' : 'Go live'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            pageNumber={list.data!.pageNumber}
            totalPages={list.data!.totalPages}
            totalCount={list.data!.totalCount}
            onChange={setPage}
          />
        </>
      )}

      {/* ==================== modals ==================== */}
      {showForm && (
        <RestaurantForm
          open={showForm}
          existing={editRow}
          onClose={() => {
            setShowForm(false);
            setEditRow(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditRow(null);
            list.reload();
          }}
        />
      )}

      {imageRow && (
        <ImagePicker
          open
          onClose={() => setImageRow(null)}
          title={`${imageRow.name} - change thumbnail`}
          currentUrl={imageRow.thumbnailUrl}
          onUpload={async (file) => {
            const { uploadApi } = await import('@/api/endpoints');
            const res = await uploadApi.image('restaurants', file);
            await adminApi.updateRestaurantImages(imageRow.restaurantId, { thumbnailUrl: res.url });
            return res.url;
          }}
          onSetUrl={async (url) => {
            await adminApi.updateRestaurantImages(imageRow.restaurantId, { thumbnailUrl: url });
          }}
          onSaved={() => {
            setImageRow(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}

/* ================================================================= */

function RestaurantForm({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing: AdminRestaurantRow | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const cuisines = useAsync(() => restaurantApi.cuisines(), []);

  const [name, setName] = useState(existing?.name ?? '');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [locality, setLocality] = useState(existing?.locality ?? '');
  const [city, setCity] = useState(existing?.city ?? 'New Delhi');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [costForTwo, setCostForTwo] = useState(existing?.costForTwo?.toString() ?? '500');
  const [openingTime, setOpeningTime] = useState(existing?.openingTime?.slice(0, 5) ?? '11:00');
  const [closingTime, setClosingTime] = useState(existing?.closingTime?.slice(0, 5) ?? '23:00');
  const [radius, setRadius] = useState(existing?.deliveryRadiusKm?.toString() ?? '15');
  const [prepTime, setPrepTime] = useState('30');
  const [selectedCuisines, setSelectedCuisines] = useState<number[]>([]);

  const [flags, setFlags] = useState({
    isPureVeg: false,
    hasOutdoorSeating: false,
    isPetFriendly: false,
    servesAlcohol: false,
    hasTableBooking: existing?.hasTableBooking ?? true,
    hasHallBooking: existing?.hasHallBooking ?? false,
    acceptsOnlineOrder: true,
    isPromoted: existing?.isPromoted ?? false,
    isActive: existing?.isActive ?? true,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickArea = (index: number) => {
    const area = PRESET_LOCATIONS[index];
    if (!area) return;
    setLat(area.lat.toString());
    setLng(area.lng.toString());
    setCity(area.city);
    setLocality(area.label.split(',')[0].trim());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const latN = Number(lat);
    const lngN = Number(lng);

    if (!Number.isFinite(latN) || !Number.isFinite(lngN) || latN === 0 || lngN === 0) {
      setError('Enter latitude/longitude - the delivery distance is calculated from it.');
      return;
    }

    setBusy(true);

    try {
      await adminApi.saveRestaurant({
        restaurantId: existing?.restaurantId ?? 0,
        name: name.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        addressLine: addressLine.trim(),
        locality: locality.trim(),
        city: city.trim(),
        pincode: pincode.trim() || null,
        latitude: latN,
        longitude: lngN,
        phone: phone.trim() || null,
        costForTwo: Number(costForTwo),
        openingTime,
        closingTime,
        deliveryRadiusKm: Number(radius),
        avgPrepTimeMin: Number(prepTime),
        cuisineIds: selectedCuisines.length > 0 ? selectedCuisines.join(',') : null,
        ...flags,
      });

      toast.success('Restaurant saved.');
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
      title={existing ? `Edit ${existing.name}` : 'New restaurant'}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="rest-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            Restaurant save karo
          </button>
        </>
      }
    >
      <form id="rest-form" onSubmit={submit} className="space-y-4">
        {existing && (
          <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            <strong>Note:</strong> This form submits every field. Fields that are not shown in the list
            (description, address, coordinates) must be filled in again, otherwise they will be
            cleared.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rf-name" className="label">Naam</label>
            <input id="rf-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={150} className="input" />
          </div>

          <div>
            <label htmlFor="rf-tag" className="label">Tagline</label>
            <input id="rf-tag" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={250} placeholder="e.g. Legendary North Indian since 1975" className="input" />
          </div>
        </div>

        <div>
          <label htmlFor="rf-desc" className="label">Description</label>
          <textarea id="rf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input resize-y" />
        </div>

        {/* ---- location ---- */}
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
          <p className="mb-3 text-sm font-semibold text-ink-800">Location</p>

          <div className="mb-3">
            <label htmlFor="rf-area" className="label">Choose an area (coordinates fill in automatically)</label>
            <select id="rf-area" onChange={(e) => e.target.value && pickArea(Number(e.target.value))} className="select" defaultValue="">
              <option value="">Choose an area</option>
              {DELIVERY_AREAS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label} (~{p.approxKm} km center se)
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="rf-addr" className="label">Address line</label>
              <input id="rf-addr" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} required minLength={5} maxLength={300} className="input" />
            </div>

            <div>
              <label htmlFor="rf-loc" className="label">Locality</label>
              <input id="rf-loc" value={locality} onChange={(e) => setLocality(e.target.value)} required maxLength={120} className="input" />
            </div>

            <div>
              <label htmlFor="rf-city" className="label">City</label>
              <input id="rf-city" value={city} onChange={(e) => setCity(e.target.value)} required maxLength={80} className="input" />
            </div>

            <div>
              <label htmlFor="rf-lat" className="label">Latitude</label>
              <input id="rf-lat" value={lat} onChange={(e) => setLat(e.target.value)} required placeholder="28.6315" className="input" />
            </div>

            <div>
              <label htmlFor="rf-lng" className="label">Longitude</label>
              <input id="rf-lng" value={lng} onChange={(e) => setLng(e.target.value)} required placeholder="77.2167" className="input" />
            </div>

            <div>
              <label htmlFor="rf-pin" className="label">Pincode</label>
              <input id="rf-pin" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input" />
            </div>

            <div>
              <label htmlFor="rf-phone" className="label">Phone</label>
              <input id="rf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className="input" />
            </div>
          </div>
        </div>

        {/* ---- business ---- */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="rf-cost" className="label">Cost for two</label>
            <input id="rf-cost" type="number" value={costForTwo} onChange={(e) => setCostForTwo(e.target.value)} required min={1} className="input" />
          </div>

          <div>
            <label htmlFor="rf-open" className="label">Opens</label>
            <input id="rf-open" type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} required className="input" />
          </div>

          <div>
            <label htmlFor="rf-close" className="label">Closes</label>
            <input id="rf-close" type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} required className="input" />
          </div>

          <div>
            <label htmlFor="rf-radius" className="label">Delivery radius (km)</label>
            <input id="rf-radius" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} required min={0.5} max={50} step={0.5} className="input" />
          </div>

          <div>
            <label htmlFor="rf-prep" className="label">Prep time (min)</label>
            <input id="rf-prep" type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} required min={5} max={180} className="input" />
          </div>
        </div>

        {/* ---- cuisines ---- */}
        <div>
          <span className="label">Cuisines</span>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {(cuisines.data ?? []).map((c) => (
              <button
                key={c.cuisineId}
                type="button"
                onClick={() =>
                  setSelectedCuisines((prev) =>
                    prev.includes(c.cuisineId) ? prev.filter((x) => x !== c.cuisineId) : [...prev, c.cuisineId],
                  )
                }
                className={`chip ${selectedCuisines.includes(c.cuisineId) ? 'chip-active' : ''}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* ---- flags ---- */}
        <div>
          <span className="label">Features</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ['isPureVeg', 'Pure veg'],
                ['hasOutdoorSeating', 'Outdoor seating'],
                ['isPetFriendly', 'Pet friendly'],
                ['servesAlcohol', 'Serves alcohol'],
                ['hasTableBooking', 'Table booking'],
                ['hasHallBooking', 'Party hall'],
                ['acceptsOnlineOrder', 'Online orders'],
                ['isPromoted', 'Promoted'],
                ['isActive', 'Active (live)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={flags[key]}
                  onChange={(e) => setFlags((f) => ({ ...f, [key]: e.target.checked }))}
                  className="size-4 accent-brand-600"
                />
                <span className="text-sm text-ink-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
