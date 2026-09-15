import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { homeApi } from '@/api/endpoints';
import type { AppSettings } from '@/types';
import { DELIVERY_AREAS, DELIVERY_CENTER } from './deliveryAreas';

const LOC_KEY = 'fm_location';

export interface UserLocation {
  city: string;
  label: string;
  lat: number | null;
  lng: number | null;
  source: 'default' | 'manual' | 'gps';
}

/**
 * Location dropdown me jo areas dikhte hain.
 * List aur coordinates `deliveryAreas.ts` me hain - naya gaon add karna
 * ho ya asli coordinates daalne hon to wahi ek file edit karo.
 */
export const PRESET_LOCATIONS: { city: string; label: string; lat: number; lng: number }[] =
  DELIVERY_AREAS.map((a) => ({ city: a.city, label: a.label, lat: a.lat, lng: a.lng }));

const DEFAULT_LOCATION: UserLocation = {
  city: DELIVERY_CENTER.district,
  label: PRESET_LOCATIONS[0]?.label ?? DELIVERY_CENTER.label,
  lat: PRESET_LOCATIONS[0]?.lat ?? DELIVERY_CENTER.lat,
  lng: PRESET_LOCATIONS[0]?.lng ?? DELIVERY_CENTER.lng,
  source: 'default',
};

interface LocationContextValue {
  location: UserLocation;
  settings: AppSettings;
  isLocating: boolean;
  gpsError: string | null;
  setLocation(loc: UserLocation): void;
  setPreset(index: number): void;
  useMyLocation(): void;
  /** WhatsApp button ke liye ready-made link */
  whatsAppLink(customMessage?: string): string;
  currency(amount: number | null | undefined): string;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function readStored(): UserLocation {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return DEFAULT_LOCATION;

    const parsed = JSON.parse(raw) as UserLocation;
    if (!parsed.city || !parsed.label) return DEFAULT_LOCATION;
    return parsed;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<UserLocation>(() => readStored());
  const [settings, setSettings] = useState<AppSettings>({});
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  /* WhatsApp number, GST %, currency etc. backend settings se aate hain */
  useEffect(() => {
    let cancelled = false;

    homeApi
      .settings()
      .then((s) => { if (!cancelled) setSettings(s ?? {}); })
      .catch(() => { /* settings na mile to defaults chal jaayenge */ });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LOC_KEY, JSON.stringify(location)); } catch { /* ignore */ }
  }, [location]);

  const setLocation = useCallback((loc: UserLocation) => {
    setGpsError(null);
    setLocationState(loc);
  }, []);

  const setPreset = useCallback((index: number) => {
    const p = PRESET_LOCATIONS[index];
    if (!p) return;
    setGpsError(null);
    setLocationState({ city: p.city, label: p.label, lat: p.lat, lng: p.lng, source: 'manual' });
  }, []);

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Your browser does not support location. Please choose an area from the list.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // sabse paas ka preset dhoond kar city label bana lete hain
        // (reverse-geocoding service nahi lagayi, coordinates asli hi rehte hain)
        let nearest = PRESET_LOCATIONS[0];
        let best = Number.POSITIVE_INFINITY;

        for (const p of PRESET_LOCATIONS) {
          const d = (p.lat - latitude) ** 2 + (p.lng - longitude) ** 2;
          if (d < best) { best = d; nearest = p; }
        }

        setLocationState({
          city: nearest.city,
          label: 'My current location',
          lat: latitude,
          lng: longitude,
          source: 'gps',
        });
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Please choose your area from the list.'
            : 'Could not get your location. Please choose your area from the list.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const value = useMemo<LocationContextValue>(() => {
    const symbol = settings.CurrencySymbol ?? 'Rs';

    return {
      location,
      settings,
      isLocating,
      gpsError,
      setLocation,
      setPreset,
      useMyLocation,

      whatsAppLink: (customMessage?: string) => {
        const number = settings.WhatsAppNumber ?? '919810000000';
        const text = customMessage ?? settings.WhatsAppMessage ?? 'Hi FoodMitra! I need some help.';
        return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
      },

      currency: (amount) => {
        if (amount === null || amount === undefined || Number.isNaN(amount)) return `${symbol} 0`;
        return `${symbol} ${Number(amount).toLocaleString('en-IN', {
          minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
          maximumFractionDigits: 2,
        })}`;
      },
    };
  }, [location, settings, isLocating, gpsError, setLocation, setPreset, useMyLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/* deliveryAreas ki cheezein yahin se bhi mil jaayein */
export { DELIVERY_AREAS, DELIVERY_CENTER, DELIVERY_SLABS, feeForDistance, MAX_DELIVERY_KM } from './deliveryAreas';

export function useLocationCtx(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationCtx must be used inside LocationProvider.');
  return ctx;
}
