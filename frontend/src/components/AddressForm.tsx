import { useState } from 'react';
import { authApi } from '@/api/endpoints';
import { DELIVERY_AREAS, PRESET_LOCATIONS, useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAction } from '@/hooks/useAsync';
import { Modal, Spinner } from './ui';
import type { Address } from '@/types';

/**
 * Address add / edit.
 *
 * Lat-long ki zaroorat hoti hai kyunki 15 km delivery radius usi se
 * calculate hota hai. Do tareeke se aata hai:
 *   - "Meri location use karo" (browser GPS)
 *   - area list se choose karo (uska center lat-long lag jaata hai)
 */
export default function AddressForm({
  open,
  onClose,
  onSaved,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (addressId: number) => void;
  existing?: Address | null;
}) {
  const { useMyLocation, location, isLocating, gpsError } = useLocationCtx();
  const toast = useToast();

  const [label, setLabel] = useState(existing?.label ?? 'Home');
  const [line, setLine] = useState(existing?.addressLine ?? '');
  const [landmark, setLandmark] = useState(existing?.landmark ?? '');
  const [city, setCity] = useState(existing?.city ?? location.city);
  const [pincode, setPincode] = useState(existing?.pincode ?? '');
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);

  const [lat, setLat] = useState<number | null>(existing?.latitude ?? location.lat);
  const [lng, setLng] = useState<number | null>(existing?.longitude ?? location.lng);
  const [areaIndex, setAreaIndex] = useState<number | ''>('');

  const { run, isBusy, error } = useAction(authApi.saveAddress);

  const pickArea = (idx: number) => {
    const area = PRESET_LOCATIONS[idx];
    if (!area) return;
    setAreaIndex(idx);
    setLat(area.lat);
    setLng(area.lng);
    setCity(area.city);
  };

  const grabGps = () => {
    useMyLocation();
    // LocationContext update hone me thoda time lagta hai, isliye
    // user ko batate hain ki wapas aane par coordinates bhar jayenge
    toast.info('Allow location access - the coordinates will fill in automatically.');
  };

  /* GPS milne ke baad context ke coordinates utha lo */
  const syncFromContext = () => {
    if (location.lat !== null && location.lng !== null) {
      setLat(location.lat);
      setLng(location.lng);
      setCity(location.city);
      toast.success('Current location le li.');
    } else {
      toast.error('Location not available yet.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lat === null || lng === null) {
      toast.error('Set a location - from GPS or the area list.');
      return;
    }

    const result = await run({
      addressId: existing?.addressId ?? 0,
      label,
      addressLine: line.trim(),
      landmark: landmark.trim() || undefined,
      city: city.trim(),
      pincode: pincode.trim() || undefined,
      latitude: lat,
      longitude: lng,
      isDefault,
    });

    if (result) {
      toast.success('Address saved.');
      onSaved(result.addressId);
    }
  };

  return (
    <Modal
      open={open}
      title={existing ? 'Edit address' : 'Add a new address'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={isBusy}>
            Cancel
          </button>
          <button type="submit" form="address-form" className="btn-primary" disabled={isBusy}>
            {isBusy && <Spinner className="size-4" />}
            Address save karo
          </button>
        </>
      }
    >
      <form id="address-form" onSubmit={submit} className="space-y-4">
        {/* ---- label ---- */}
        <div>
          <span className="label">What is this address for?</span>
          <div className="flex gap-2">
            {['Home', 'Work', 'Other'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLabel(l)}
                className={`chip ${label === l ? 'chip-active' : ''}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ---- address line ---- */}
        <div>
          <label htmlFor="ad-line" className="label">
            Flat / house, building, street
          </label>
          <input
            id="ad-line"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            required
            minLength={5}
            maxLength={300}
            placeholder="e.g. Flat 402, Sunrise Apartments, Sector 15"
            className="input"
          />
        </div>

        {/* ---- landmark ---- */}
        <div>
          <label htmlFor="ad-landmark" className="label">
            Landmark (optional)
          </label>
          <input
            id="ad-landmark"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            maxLength={160}
            placeholder="e.g. near the metro station"
            className="input"
          />
        </div>

        {/* ---- city + pincode ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ad-city" className="label">
              City
            </label>
            <input
              id="ad-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              maxLength={80}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="ad-pin" className="label">
              Pincode
            </label>
            <input
              id="ad-pin"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="110001"
              className="input"
            />
          </div>
        </div>

        {/* ---- location ---- */}
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
          <p className="text-sm font-semibold text-ink-800">Location (for delivery distance)</p>
          <p className="mt-0.5 text-xs text-ink-500">
            Without this the 15 km delivery check cannot run.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={grabGps} className="btn-outline btn-sm" disabled={isLocating}>
              {isLocating && <Spinner className="size-3.5" />}
              GPS se lo
            </button>

            <button type="button" onClick={syncFromContext} className="btn-outline btn-sm">
              Current location bharo
            </button>
          </div>

          {gpsError && <p className="mt-2 text-xs text-brand-700">{gpsError}</p>}

          <div className="mt-3">
            <label htmlFor="ad-area" className="label">
              Or choose from the area list
            </label>
            <select
              id="ad-area"
              value={areaIndex}
              onChange={(e) => pickArea(Number(e.target.value))}
              className="select"
            >
              <option value="">Choose an area</option>
              {DELIVERY_AREAS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label} (~{p.approxKm} km{p.deliveryFee !== null ? ` - Rs ${p.deliveryFee}` : ''})
                </option>
              ))}
            </select>
          </div>

          <p className="mt-2.5 text-xs font-medium text-ink-600">
            {lat !== null && lng !== null
              ? `Set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
              : 'No location set yet'}
          </p>
        </div>

        {/* ---- default ---- */}
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="size-4 accent-brand-600"
          />
          <span className="text-sm text-ink-700">Ise default address bana do</span>
        </label>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
