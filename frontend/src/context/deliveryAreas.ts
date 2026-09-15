/* ============================================================
   Delivery areas - jo jagah aapne batayi hain.

   >>> IMPORTANT: coordinates ke baare me padho <<<

   Har area ke liye do tarike hain:

   A) `lat` aur `lng` seedha do  (SAHI TAREEKA - ye pehle use hota hai)
      Google Maps kholo -> us jagah par right-click -> pehla option
      (jaise "25.531234, 81.382345") click karo -> yahan paste kar do.

   B) `km` + `bearing` do  (ABHI YAHI LAGA HUA HAI)
      Iske liye coordinates DELIVERY_CENTER se calculate hote hain.
      Doori bilkul sahi aati hai (isliye delivery charge sahi lagta hai),
      par gaon ki asli disha/position sahi nahi hoti.

   Matlab: delivery charge abhi se sahi kaam karega, par map par
   sahi jagah dikhane ke liye `lat`/`lng` daalna behtar hai.
   ============================================================ */

/**
 * Aapki dukaan / kitchen ki location.
 *
 * !! YE PLACEHOLDER HAI - iske coordinates verified nahi hain !!
 * Ise apni asli location se badal do - baaki saare gaon apne aap
 * usi ke hisaab se shift ho jayenge.
 */
export const DELIVERY_CENTER = {
  label: 'My shop (centre)',
  district: 'Kaushambi',
  state: 'Uttar Pradesh',
  lat: 25.53,
  lng: 81.38,
};

/** Maximum delivery range (km) - iske bahar order place nahi hoga. */
export const MAX_DELIVERY_KM = 15;

/**
 * Delivery charge ki rate list.
 * Ye sirf DIKHANE ke liye hai - asli charge server par
 * dbo.fn_DeliveryFee se lagta hai (dono ek jaise rakho).
 */
export const DELIVERY_SLABS: { upToKm: number; fee: number; label: string }[] = [
  { upToKm: 1, fee: 20, label: '1 km tak' },
  { upToKm: 3, fee: 30, label: '1 - 3 km' },
  { upToKm: 5, fee: 40, label: '3 - 5 km' },
  { upToKm: 10, fee: 65, label: '5 - 10 km' },
  { upToKm: 15, fee: 90, label: '10 - 15 km' },
];

/** Kisi doori par kitna charge lagega (frontend preview ke liye). */
export function feeForDistance(km: number | null | undefined): number | null {
  if (km === null || km === undefined) return null;
  if (km > MAX_DELIVERY_KM) return null; // range se bahar

  return DELIVERY_SLABS.find((s) => km <= s.upToKm)?.fee ?? null;
}

/* ------------------------------------------------------------------ */

interface AreaInput {
  name: string;
  /** Aapki batayi hui doori (km) - charge isi se lagta hai */
  km: number;
  /** Center se disha (0 = North, 90 = East). Sirf position spread karne ke liye. */
  bearing: number;
  /** Asli coordinates pata ho to yahan do - tab km/bearing ignore ho jaate hain */
  lat?: number;
  lng?: number;
}

/**
 * Aapke diye hue areas, aapki batayi doori ke saath.
 * Range wali doori (jaise "2-3 km") ka beech ka number liya hai.
 *
 * Naya area add karna ho to bas is list me ek line daal do.
 */
const AREAS: AreaInput[] = [
  { name: 'Pata', km: 1.0, bearing: 20 },
  { name: 'Diha Salempur', km: 2.0, bearing: 55 },
  { name: 'Mawai Kewat', km: 2.0, bearing: 110 },
  { name: 'Chak Aureha', km: 2.0, bearing: 165 },
  { name: 'Osa', km: 2.5, bearing: 200 },
  { name: 'Faridpur', km: 2.5, bearing: 245 },
  { name: 'Gaura', km: 2.5, bearing: 290 },
  { name: 'Kurron', km: 2.5, bearing: 330 },
  { name: 'Bhandesar', km: 2.8, bearing: 10 },
  { name: 'Tewa', km: 7.0, bearing: 70 },
  { name: 'Chak', km: 8.0, bearing: 130 },
  { name: 'Nara', km: 10.0, bearing: 185 },
  { name: 'Balipur', km: 10.0, bearing: 225 },
  { name: 'Karari', km: 10.0, bearing: 300 },
  { name: 'Sarai Aqil', km: 12.5, bearing: 45 },
  // "~15 km" wale thoda andar rakhe hain (14.8) taaki
  // rounding ki wajah se 15 km limit cross na ho jaye
  { name: 'Pashchim Sharira', km: 14.5, bearing: 260 },
  { name: 'Purab Sharira', km: 14.8, bearing: 95 },
  { name: 'Kaushambi', km: 14.8, bearing: 150 },
];

/* ----------------------- distance -> coordinates ------------------- */

const EARTH_RADIUS_KM = 6371;

/**
 * Center se di hui doori aur disha par lat/lng nikalta hai.
 * (Great-circle destination formula.)
 */
function offsetFromCenter(km: number, bearingDeg: number) {
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (DELIVERY_CENTER.lat * Math.PI) / 180;
  const lng1 = (DELIVERY_CENTER.lng * Math.PI) / 180;
  const angular = km / EARTH_RADIUS_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: Number(((lat2 * 180) / Math.PI).toFixed(6)),
    lng: Number(((lng2 * 180) / Math.PI).toFixed(6)),
  };
}

export interface DeliveryArea {
  city: string;
  label: string;
  lat: number;
  lng: number;
  /** Center se doori - UI me "~2 km - Rs 30" dikhane ke liye */
  approxKm: number;
  deliveryFee: number | null;
  /** true = asli coordinates diye gaye hain, false = doori se banaye hain */
  hasRealCoordinates: boolean;
}

/** App me use hone wali final list. */
export const DELIVERY_AREAS: DeliveryArea[] = AREAS.map((a) => {
  const hasReal = a.lat !== undefined && a.lng !== undefined;
  const point = hasReal ? { lat: a.lat!, lng: a.lng! } : offsetFromCenter(a.km, a.bearing);

  return {
    city: DELIVERY_CENTER.district,
    label: `${a.name}, ${DELIVERY_CENTER.district}`,
    lat: point.lat,
    lng: point.lng,
    approxKm: a.km,
    deliveryFee: feeForDistance(a.km),
    hasRealCoordinates: hasReal,
  };
});
