import { useState } from 'react';
import { adminApi } from '@/api/endpoints';
import ImagePicker from '@/components/ImagePicker';
import {
  Badge, ConfirmDialog, EmptyState, ErrorBanner, Modal, RowsSkeleton, SafeImage,
  Spinner, StarPicker,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';
import type { Testimonial } from '@/types';

/**
 * "Happy customers" section - home page par jo testimonials dikhte hain
 * wo yahin se manage hote hain.
 */
export default function AdminTestimonials() {
  usePageTitle('Happy customers');

  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Testimonial | null>(null);
  const [imageItem, setImageItem] = useState<Testimonial | null>(null);
  const [deleteItem, setDeleteItem] = useState<Testimonial | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const list = useAsync(() => adminApi.testimonials(), []);

  const doDelete = async () => {
    if (!deleteItem) return;

    setDeleteBusy(true);
    try {
      await adminApi.deleteTestimonial(deleteItem.testimonialId);
      toast.success('Testimonial deleted.');
      setDeleteItem(null);
      list.reload();
    } catch (err) {
      toast.fromError(err, 'Could not delete.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Happy customers</h1>
          <p className="text-sm text-ink-500">These appear in the testimonial section on the home page.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditItem(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + New testimonial
        </button>
      </div>

      {list.error ? (
        <ErrorBanner message={list.error} onRetry={list.reload} />
      ) : list.isLoading ? (
        <RowsSkeleton rows={4} />
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No testimonials yet"
          description="Add the first testimonial for the 'Happy customers' section on the home page."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.data!.map((t) => (
            <article key={t.testimonialId} className={`card p-5 ${t.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <StarPicker value={t.rating} readOnly size="sm" />
                <Badge tone={t.isActive ? 'green' : 'gray'}>{t.isActive ? 'Live' : 'Hidden'}</Badge>
              </div>

              <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-600">{t.message}</p>

              <div className="mt-4 flex items-center gap-3 border-t border-ink-100 pt-4">
                <button
                  type="button"
                  onClick={() => setImageItem(t)}
                  className="group relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-full bg-ink-100"
                  title="Change photo"
                >
                  {t.customerImage ? (
                    <SafeImage src={t.customerImage} alt={t.customerName} className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-sm font-bold text-ink-500">
                      {t.customerName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-ink-900/60 opacity-0 transition group-hover:opacity-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="size-3.5">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{t.customerName}</p>
                  <p className="truncate text-xs text-ink-500">
                    {[t.designation, t.city].filter(Boolean).join(' - ') || 'Customer'}
                  </p>
                </div>

                <span className="shrink-0 text-xs text-ink-400">#{t.displayOrder}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditItem(t);
                    setShowForm(true);
                  }}
                  className="btn-outline btn-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteItem(t)}
                  className="btn-ghost btn-sm !text-brand-700"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <TestimonialForm
          open={showForm}
          existing={editItem}
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditItem(null);
            list.reload();
          }}
        />
      )}

      {imageItem && (
        <ImagePicker
          open
          onClose={() => setImageItem(null)}
          title={`${imageItem.customerName} - change photo`}
          currentUrl={imageItem.customerImage}
          onUpload={async (file) => {
            const { uploadApi } = await import('@/api/endpoints');
            const res = await uploadApi.image('profiles', file);
            await adminApi.saveTestimonial({ ...imageItem, customerImage: res.url });
            return res.url;
          }}
          onSetUrl={async (url) => {
            await adminApi.saveTestimonial({ ...imageItem, customerImage: url });
          }}
          onSaved={() => {
            setImageItem(null);
            list.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteItem !== null}
        title="Delete this testimonial?"
        message={`"${deleteItem?.customerName}"'s testimonial will be removed from the home page. This cannot be undone.`}
        confirmLabel="Yes, delete"
        danger
        busy={deleteBusy}
        onConfirm={doDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}

/* ================================================================= */

function TestimonialForm({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing: Testimonial | null;
  onSaved: () => void;
}) {
  const toast = useToast();

  const [customerName, setCustomerName] = useState(existing?.customerName ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [designation, setDesignation] = useState(existing?.designation ?? '');
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [message, setMessage] = useState(existing?.message ?? '');
  const [displayOrder, setDisplayOrder] = useState(existing?.displayOrder?.toString() ?? '0');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [customerImage, setCustomerImage] = useState(existing?.customerImage ?? '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await adminApi.saveTestimonial({
        testimonialId: existing?.testimonialId ?? 0,
        customerName: customerName.trim(),
        customerImage: customerImage.trim() || undefined,
        city: city.trim() || undefined,
        designation: designation.trim() || undefined,
        rating,
        message: message.trim(),
        displayOrder: Number(displayOrder) || 0,
        isActive,
      });

      toast.success('Testimonial saved.');
      onSaved();
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
          ? err.detail
          : 'Could not save.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={existing ? 'Edit testimonial' : 'New testimonial'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="tm-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            Save
          </button>
        </>
      }
    >
      <form id="tm-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="tm-name" className="label">Customer ka naam</label>
          <input
            id="tm-name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            maxLength={120}
            className="input"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tm-city" className="label">City</label>
            <input id="tm-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className="input" />
          </div>

          <div>
            <label htmlFor="tm-desig" className="label">Designation</label>
            <input
              id="tm-desig"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              maxLength={120}
              placeholder="e.g. Software Engineer"
              className="input"
            />
          </div>
        </div>

        <div>
          <span className="label">Rating</span>
          <StarPicker value={rating} onChange={setRating} />
        </div>

        <div>
          <label htmlFor="tm-msg" className="label">Testimonial</label>
          <textarea
            id="tm-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            placeholder="Customer ne kya kaha"
            className="input resize-y"
          />
          <p className="mt-1 text-xs text-ink-400">{message.length} / 1000 characters</p>
        </div>

        <div>
          <label htmlFor="tm-img" className="label">Photo URL (optional)</label>
          <input
            id="tm-img"
            value={customerImage}
            onChange={(e) => setCustomerImage(e.target.value)}
            maxLength={500}
            placeholder="https://..."
            className="input"
          />
          <p className="mt-1 text-xs text-ink-400">
            To upload a file, save first and then click the photo on the card.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tm-order" className="label">Display order</label>
            <input
              id="tm-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              min={0}
              className="input"
            />
            <p className="mt-1 text-xs text-ink-400">A smaller number shows first.</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 sm:mt-7">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-brand-600"
            />
            <span className="text-sm text-ink-700">Home page par dikhao</span>
          </label>
        </div>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
