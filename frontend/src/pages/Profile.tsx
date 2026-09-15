import { useState } from 'react';
import { authApi } from '@/api/endpoints';
import AddressForm from '@/components/AddressForm';
import {
  Badge, ConfirmDialog, ErrorBanner, RowsSkeleton, Spinner,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAction, useAsync, usePageTitle } from '@/hooks/useAsync';
import type { Address } from '@/types';

export default function Profile() {
  usePageTitle('Profile');

  const { user, patchUser } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const addresses = useAsync(() => authApi.addresses(), []);

  const profileAction = useAction(authApi.updateProfile);
  const passwordAction = useAction(authApi.changePassword);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await profileAction.run({ fullName: fullName.trim(), phone: phone.trim() || undefined });
    if (ok !== null) {
      patchUser({ fullName: fullName.trim(), phone: phone.trim() || null });
      toast.success('Profile updated.');
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await passwordAction.run({ currentPassword, newPassword });
    if (ok !== null) {
      toast.success('Password changed. You have been signed out of all other devices.');
      setCurrentPassword('');
      setNewPassword('');
    }
  };

  const deleteAddress = async () => {
    if (deleteId === null) return;

    setDeleteBusy(true);
    try {
      await authApi.deleteAddress(deleteId);
      toast.success('Address deleted.');
      setDeleteId(null);
      addresses.reload();
    } catch (err) {
      toast.fromError(err, 'Could not delete.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="container-app py-6">
      <h1 className="mb-1 text-2xl font-bold text-ink-900 sm:text-3xl">Profile</h1>
      <p className="mb-6 text-sm text-ink-500">Manage your details and saved addresses.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ==================== profile details ==================== */}
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">My details</h2>

          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white">
              {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink-900">{user?.email}</p>
              <Badge tone="blue">{user?.role}</Badge>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label htmlFor="pf-name" className="label">
                Poora naam
              </label>
              <input
                id="pf-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="pf-phone" className="label">
                Phone number
              </label>
              <input
                id="pf-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                maxLength={20}
                className="input"
              />
            </div>

            <div>
              <span className="label">Email</span>
              <input value={user?.email ?? ''} disabled className="input" />
              <p className="mt-1 text-xs text-ink-400">Contact support to change your email.</p>
            </div>

            {profileAction.error && <p className="field-error">{profileAction.error}</p>}

            <button type="submit" disabled={profileAction.isBusy} className="btn-primary">
              {profileAction.isBusy && <Spinner className="size-4" />}
              Profile save karo
            </button>
          </form>
        </section>

        {/* ==================== password ==================== */}
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Change password</h2>

          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label htmlFor="pf-cur" className="label">
                Current password
              </label>
              <input
                id="pf-cur"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="pf-new" className="label">
                New password
              </label>
              <input
                id="pf-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
              />
              <p className="mt-1 text-xs text-ink-400">
                Must have 8+ characters, one letter and one number.
              </p>
            </div>

            {passwordAction.error && <p className="field-error">{passwordAction.error}</p>}

            <button type="submit" disabled={passwordAction.isBusy} className="btn-outline">
              {passwordAction.isBusy && <Spinner className="size-4" />}
              Change password
            </button>

            <p className="text-xs text-ink-400">
              Changing your password signs you out of all devices (for security).
            </p>
          </form>
        </section>

        {/* ==================== addresses ==================== */}
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Saved addresses</h2>
              <p className="text-xs text-ink-500">
                The 15 km delivery check uses the coordinates of these addresses.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingAddress(null);
                setShowAddressForm(true);
              }}
              className="btn-primary btn-sm"
            >
              + New address
            </button>
          </div>

          {addresses.error ? (
            <ErrorBanner message={addresses.error} onRetry={addresses.reload} />
          ) : addresses.isLoading ? (
            <RowsSkeleton rows={2} />
          ) : (addresses.data?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-500">
              No saved addresses. Add one to make checkout faster.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.data!.map((a) => (
                <div key={a.addressId} className="rounded-xl border border-ink-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink-900">{a.label}</p>
                        {a.isDefault && <Badge tone="blue">Default</Badge>}
                      </div>

                      <p className="mt-1 text-sm text-ink-600">{a.addressLine}</p>
                      {a.landmark && <p className="text-xs text-ink-400">{a.landmark}</p>}
                      <p className="text-xs text-ink-400">
                        {a.city} {a.pincode}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-ink-300">
                        {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddress(a);
                        setShowAddressForm(true);
                      }}
                      className="btn-outline btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(a.addressId)}
                      className="btn-ghost btn-sm !text-brand-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---- address form ---- */}
      {showAddressForm && (
        <AddressForm
          open={showAddressForm}
          existing={editingAddress}
          onClose={() => {
            setShowAddressForm(false);
            setEditingAddress(null);
          }}
          onSaved={() => {
            setShowAddressForm(false);
            setEditingAddress(null);
            addresses.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this address?"
        message="This address will be removed from the list. Past orders are unaffected."
        confirmLabel="Yes, delete"
        danger
        busy={deleteBusy}
        onConfirm={deleteAddress}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
