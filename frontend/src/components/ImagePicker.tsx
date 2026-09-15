import { useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { Modal, SafeImage, Spinner } from './ui';

/* ============================================================
   Food / restaurant / hall ki image badalne ka UI.

   Do tareeke:
     1) File upload  -> server par save hoke URL milta hai
     2) Image URL    -> bahar ki koi bhi image URL paste karo

   `onUpload` aur `onSetUrl` parent deta hai, isliye yahi component
   admin aur employee dono panel me chal jaata hai.
   ============================================================ */

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Abhi jo image lagi hai */
  currentUrl?: string | null;
  /** File upload handler - naya URL return kare */
  onUpload: (file: File) => Promise<string>;
  /** URL se set karne ka handler */
  onSetUrl: (url: string) => Promise<void>;
  /** Save hone ke baad parent list refresh kare */
  onSaved: () => void;
}

export default function ImagePicker({
  open,
  onClose,
  title,
  currentUrl,
  onUpload,
  onSetUrl,
  onSaved,
}: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setUrl('');
    setError(null);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickFile = (picked: File | null | undefined) => {
    setError(null);

    if (!picked) return;

    if (!ALLOWED.includes(picked.type)) {
      setError('Sirf jpg, png, webp, gif ya avif image chalegi.');
      return;
    }

    if (picked.size > MAX_BYTES) {
      setError(`The file cannot be larger than 5 MB (this one is ${(picked.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }

    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const save = async () => {
    setError(null);
    setBusy(true);

    try {
      if (tab === 'upload') {
        if (!file) {
          setError('Please choose an image first.');
          return;
        }
        await onUpload(file);
      } else {
        const trimmed = url.trim();

        if (!trimmed) {
          setError('Enter an image URL.');
          return;
        }

        if (!/^https?:\/\/.+/i.test(trimmed) && !trimmed.startsWith('/uploads/')) {
          setError('The URL must start with http:// or https://.');
          return;
        }

        await onSetUrl(trimmed);
      }

      toast.success('Image updated.');
      onSaved();
      close();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Could not save the image.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <button type="button" onClick={close} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="btn-primary"
            disabled={busy || (tab === 'upload' ? !file : !url.trim())}
          >
            {busy && <Spinner className="size-4" />}
            Image save karo
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ---------------- current image ---------------- */}
        {currentUrl && (
          <div>
            <p className="label">Current image</p>
            <SafeImage
              src={currentUrl}
              alt="Current"
              className="h-32 w-full rounded-lg border border-ink-100 object-cover"
            />
          </div>
        )}

        {/* ---------------- tabs ---------------- */}
        <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
          {(
            [
              { key: 'upload', label: 'Upload a file' },
              { key: 'url', label: 'Image URL do' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setError(null); }}
              className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-semibold transition ${
                tab === t.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ---------------- upload tab ---------------- */}
        {tab === 'upload' && (
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 transition ${
                dragOver ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-ink-50 hover:border-ink-300'
              }`}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="h-32 rounded-lg object-contain" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-9 text-ink-400">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-semibold text-ink-700">Click or drag a file here</p>
                  <p className="text-xs text-ink-400">jpg, png, webp, gif, avif - max 5 MB</p>
                </>
              )}
            </button>

            {file && (
              <p className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-500">
                <span className="truncate">
                  {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="cursor-pointer shrink-0 font-semibold text-brand-700 hover:underline"
                >
                  Hatao
                </button>
              </p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED.join(',')}
              onChange={(e) => pickFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>
        )}

        {/* ---------------- url tab ---------------- */}
        {tab === 'url' && (
          <div>
            <label htmlFor="img-url" className="label">
              Image ka URL
            </label>
            <input
              id="img-url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="https://images.unsplash.com/photo-..."
              className="input"
            />
            <p className="mt-1 text-xs text-ink-400">
              You can paste any public image URL. The file is not copied to the server - it is
              loaded directly from that address.
            </p>

            {url.trim() && /^https?:\/\/.+/i.test(url.trim()) && (
              <div className="mt-3">
                <p className="label">Preview</p>
                <SafeImage
                  src={url.trim()}
                  alt="URL preview"
                  className="h-32 w-full rounded-lg border border-ink-100 object-cover"
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
