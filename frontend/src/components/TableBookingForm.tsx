import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableBookingApi } from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAction } from '@/hooks/useAsync';
import { Modal, Spinner } from './ui';

const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00',
];

const OCCASIONS = ['Casual', 'Birthday', 'Anniversary', 'Business', 'Date night', 'Family get-together'];

function todayIso() {
  // IST me aaj ki date
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
}

export default function TableBookingForm({
  open,
  onClose,
  restaurant,
}: {
  open: boolean;
  onClose: () => void;
  restaurant: { id: number; name: string; hasOutdoor: boolean };
}) {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('20:00');
  const [guests, setGuests] = useState(2);
  const [duration, setDuration] = useState(90);
  const [seating, setSeating] = useState('');
  const [occasion, setOccasion] = useState('Casual');
  const [request, setRequest] = useState('');
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [availability, setAvailability] = useState<{ isAvailable: boolean; count: number } | null>(null);
  const [checking, setChecking] = useState(false);

  const { run: createBooking, isBusy, error } = useAction(tableBookingApi.create);

  /* date/time/guests badalte hi availability check */
  useEffect(() => {
    if (!open) return;

    let active = true;
    setChecking(true);
    setAvailability(null);

    const t = setTimeout(() => {
      tableBookingApi
        .availability({
          restaurantId: restaurant.id,
          bookingDate: date,
          bookingTime: time,
          guestCount: guests,
          durationMin: duration,
          seatingPref: seating || undefined,
        })
        .then((res) => {
          if (active) setAvailability({ isAvailable: res.isAvailable, count: res.availableCount });
        })
        .catch(() => {
          if (active) setAvailability(null);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, restaurant.id, date, time, guests, duration, seating]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.info('Please log in to book a table.');
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }

    const result = await createBooking({
      restaurantId: restaurant.id,
      guestName: name.trim(),
      guestPhone: phone.trim(),
      bookingDate: date,
      bookingTime: time,
      guestCount: guests,
      durationMin: duration,
      seatingPref: seating || undefined,
      occasion: occasion || undefined,
      specialRequest: request.trim() || undefined,
    });

    if (result) {
      toast.success(result.message ?? 'Table booking requested.');
      onClose();
      navigate('/my-bookings');
    }
  };

  const maxDate = new Date(Date.now() + 89 * 86400000).toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      title={`${restaurant.name} - book a table`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={isBusy}>
            Cancel
          </button>
          <button
            type="submit"
            form="table-booking-form"
            className="btn-primary"
            disabled={isBusy || availability?.isAvailable === false}
          >
            {isBusy && <Spinner className="size-4" />}
            Booking confirm karo
          </button>
        </>
      }
    >
      <form id="table-booking-form" onSubmit={submit} className="space-y-4">
        {/* ---- date / time ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tb-date" className="label">Date</label>
            <input
              id="tb-date"
              type="date"
              value={date}
              min={todayIso()}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="tb-time" className="label">Time</label>
            <select id="tb-time" value={time} onChange={(e) => setTime(e.target.value)} className="select">
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ---- guests ---- */}
        <div>
          <span className="label">Kitne log?</span>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGuests(n)}
                className={`chip ${guests === n ? 'chip-active' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-400">
            For more than 20 guests, please use Party hall booking.
          </p>
        </div>

        {/* ---- availability banner ---- */}
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            checking
              ? 'border-ink-200 bg-ink-50 text-ink-500'
              : availability?.isAvailable
                ? 'border-green-200 bg-green-50 text-green-800'
                : availability
                  ? 'border-brand-200 bg-brand-50 text-brand-800'
                  : 'border-ink-200 bg-ink-50 text-ink-500'
          }`}
        >
          {checking ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-4" /> Checking tables...
            </span>
          ) : availability?.isAvailable ? (
            <>
              <strong>{availability.count} table{availability.count === 1 ? '' : 's'} free hain</strong>{' '}
              {date} ko {time} par. Booking kar lo.
            </>
          ) : availability ? (
            <>No table is free at this time. Try another time or date.</>
          ) : (
            <>Could not check availability - you can still try to book.</>
          )}
        </div>

        {/* ---- seating + duration ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tb-seating" className="label">Seating preference</label>
            <select
              id="tb-seating"
              value={seating}
              onChange={(e) => setSeating(e.target.value)}
              className="select"
            >
              <option value="">Any</option>
              <option value="Indoor">Indoor</option>
              {restaurant.hasOutdoor && <option value="Outdoor">Outdoor</option>}
            </select>
          </div>

          <div>
            <label htmlFor="tb-duration" className="label">For how long</label>
            <select
              id="tb-duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="select"
            >
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
          </div>
        </div>

        {/* ---- occasion ---- */}
        <div>
          <label htmlFor="tb-occasion" className="label">Occasion</label>
          <select
            id="tb-occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            className="select"
          >
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* ---- contact ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tb-name" className="label">Guest ka naam</label>
            <input
              id="tb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="tb-phone" className="label">Phone number</label>
            <input
              id="tb-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              pattern="[0-9+\-\s()]{7,20}"
              placeholder="9810000000"
              className="input"
            />
          </div>
        </div>

        {/* ---- special request ---- */}
        <div>
          <label htmlFor="tb-request" className="label">Any special request? (optional)</label>
          <textarea
            id="tb-request"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. corner table please, cake cutting, need a high chair"
            className="input resize-y"
          />
        </div>

        {error && <p className="field-error">{error}</p>}

        <p className="text-xs text-ink-400">
          The booking stays PENDING until the restaurant confirms it. You will see the
          confirmation on your "My bookings" page.
        </p>
      </form>
    </Modal>
  );
}
