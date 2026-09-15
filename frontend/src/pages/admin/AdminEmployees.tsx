import { useState } from 'react';
import { adminApi } from '@/api/endpoints';
import {
  Badge, ConfirmDialog, EmptyState, ErrorBanner, Modal, Pagination, RowsSkeleton, Spinner,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAsync, useDebounced, usePageTitle } from '@/hooks/useAsync';
import type { Assignment, Employee } from '@/types';

/* ============================================================
   Employee management + "kisko kaunsa restaurant dena hai".

   Ek employee ko kai restaurants assign ho sakte hain, aur har
   restaurant par alag permissions (menu / order / booking).
   ============================================================ */

const DESIGNATIONS = [
  'Manager',
  'Supervisor',
  'Menu Manager',
  'Banquet Manager',
  'Chef',
  'Waiter',
  'DeliveryBoy',
];

/** Designation ke hisaab se sensible default permissions. */
const DEFAULT_PERMISSIONS: Record<string, { menu: boolean; order: boolean; booking: boolean }> = {
  Manager: { menu: true, order: true, booking: true },
  Supervisor: { menu: false, order: true, booking: true },
  'Menu Manager': { menu: true, order: false, booking: false },
  'Banquet Manager': { menu: false, order: false, booking: true },
  Chef: { menu: true, order: true, booking: false },
  Waiter: { menu: false, order: true, booking: true },
  DeliveryBoy: { menu: false, order: true, booking: false },
};

export default function AdminEmployees() {
  usePageTitle('Employees');

  const toast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [restaurantFilter, setRestaurantFilter] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [assignFor, setAssignFor] = useState<Employee | null>(null);
  const [toggleFor, setToggleFor] = useState<Employee | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const employees = useAsync(
    () =>
      adminApi.employees({
        search: debouncedSearch || undefined,
        restaurantId: restaurantFilter ? Number(restaurantFilter) : undefined,
        unassigned: onlyUnassigned,
        pageNumber: page,
        pageSize: 20,
      }),
    [debouncedSearch, restaurantFilter, onlyUnassigned, page],
  );

  const restaurants = useAsync(() => adminApi.restaurants({ pageSize: 100 }), []);

  const doToggle = async () => {
    if (!toggleFor) return;

    setToggleBusy(true);
    try {
      await adminApi.toggleEmployee(toggleFor.userId, !toggleFor.isActive);
      toast.success(
        toggleFor.isActive
          ? `${toggleFor.fullName} has been deactivated.`
          : `${toggleFor.fullName} has been activated.`,
      );
      setToggleFor(null);
      employees.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    } finally {
      setToggleBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ---------------- header ---------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Employees</h1>
          <p className="text-sm text-ink-500">
            Create employees and decide which restaurant each one gets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditEmployee(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + New employee
        </button>
      </div>

      {/* ---------------- filters ---------------- */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-48 flex-1">
          <label htmlFor="ae-search" className="label">
            Dhoondo
          </label>
          <input
            id="ae-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Naam, email ya phone"
            className="input"
          />
        </div>

        <div className="min-w-56 flex-1">
          <label htmlFor="ae-rest" className="label">
            Filter by restaurant
          </label>
          <select
            id="ae-rest"
            value={restaurantFilter}
            onChange={(e) => {
              setRestaurantFilter(e.target.value);
              setPage(1);
            }}
            className="select"
          >
            <option value="">All employees</option>
            {(restaurants.data?.items ?? []).map((r) => (
              <option key={r.restaurantId} value={r.restaurantId}>
                {r.name} - {r.locality}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setOnlyUnassigned((v) => !v);
            setPage(1);
          }}
          className={`chip ${onlyUnassigned ? 'chip-active' : ''}`}
        >
          Without any restaurant
        </button>
      </div>

      {/* ---------------- list ---------------- */}
      {employees.error ? (
        <ErrorBanner message={employees.error} onRetry={employees.reload} />
      ) : employees.isLoading ? (
        <RowsSkeleton rows={5} />
      ) : (employees.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No employees found"
          description={search ? 'Try a different search.' : 'Add your first employee.'}
          action={
            <button
              type="button"
              onClick={() => {
                setEditEmployee(null);
                setShowForm(true);
              }}
              className="btn-primary"
            >
              + New employee
            </button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {employees.data!.items.map((e) => (
              <li key={e.userId} className="card p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white">
                    {e.fullName.charAt(0).toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-ink-900">{e.fullName}</h2>
                      <Badge tone={e.isActive ? 'green' : 'red'}>
                        {e.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {e.assignedRestaurantCount === 0 && <Badge tone="amber">No restaurant</Badge>}
                    </div>

                    <p className="mt-0.5 text-sm text-ink-600">{e.email}</p>
                    {e.phone && <p className="text-sm text-ink-500">{e.phone}</p>}

                    {/* ---- assigned restaurants ---- */}
                    <div className="mt-2.5">
                      <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">
                        Assigned restaurants ({e.assignedRestaurantCount})
                      </p>

                      {e.assignedRestaurants ? (
                        <p className="mt-1 text-sm text-ink-700">{e.assignedRestaurants}</p>
                      ) : (
                        <p className="mt-1 text-sm text-ink-400 italic">
                          No restaurant assigned yet
                        </p>
                      )}

                      {e.designations && (
                        <p className="mt-0.5 text-xs text-ink-500">Role: {e.designations}</p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-ink-900">{e.deliveredOrders}</p>
                    <p className="text-xs text-ink-400">deliveries</p>
                  </div>
                </div>

                {/* ---- actions ---- */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setAssignFor(e)}
                    className="btn-primary btn-sm"
                  >
                    Assign restaurant
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditEmployee(e);
                      setShowForm(true);
                    }}
                    className="btn-outline btn-sm"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => setToggleFor(e)}
                    className={`btn-sm ${e.isActive ? 'btn-ghost !text-brand-700' : 'btn-outline'}`}
                  >
                    {e.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            pageNumber={employees.data!.pageNumber}
            totalPages={employees.data!.totalPages}
            totalCount={employees.data!.totalCount}
            onChange={setPage}
          />
        </>
      )}

      {/* ==================== modals ==================== */}
      {showForm && (
        <EmployeeForm
          open={showForm}
          existing={editEmployee}
          onClose={() => {
            setShowForm(false);
            setEditEmployee(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditEmployee(null);
            employees.reload();
          }}
        />
      )}

      {assignFor && (
        <AssignRestaurantsModal
          employee={assignFor}
          restaurants={(restaurants.data?.items ?? []).map((r) => ({
            restaurantId: r.restaurantId,
            name: r.name,
            locality: r.locality,
            city: r.city,
          }))}
          onClose={() => setAssignFor(null)}
          onChanged={() => employees.reload()}
        />
      )}

      <ConfirmDialog
        open={toggleFor !== null}
        title={toggleFor?.isActive ? 'Deactivate this employee?' : 'Activate this employee?'}
        message={
          toggleFor?.isActive
            ? `${toggleFor?.fullName} will not be able to log in and all their sessions will be signed out. Assignments are kept.`
            : `${toggleFor?.fullName} will be able to log in again with their assigned restaurants.`
        }
        confirmLabel={toggleFor?.isActive ? 'Yes, deactivate' : 'Yes, activate'}
        danger={toggleFor?.isActive ?? false}
        busy={toggleBusy}
        onConfirm={doToggle}
        onCancel={() => setToggleFor(null)}
      />
    </div>
  );
}

/* ================================================================= */
/*                      EMPLOYEE CREATE / EDIT                       */
/* ================================================================= */

function EmployeeForm({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing: Employee | null;
  onSaved: () => void;
}) {
  const toast = useToast();

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!existing && password.length < 8) {
      setError('Set a password of at least 8 characters for a new employee.');
      return;
    }

    setBusy(true);

    try {
      const result = await adminApi.saveEmployee({
        userId: existing?.userId ?? 0,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: password.trim() || undefined,
        isActive,
      });

      if (result.userId <= 0) {
        setError(result.message);
        return;
      }

      toast.success(existing ? 'Employee updated.' : 'New employee created.');
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
      title={existing ? `Edit ${existing.fullName}` : 'New employee'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="emp-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            Employee save karo
          </button>
        </>
      }
    >
      <form id="emp-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="ef-name" className="label">Poora naam</label>
          <input
            id="ef-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="ef-email" className="label">Email (used to log in)</label>
          <input
            id="ef-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
        </div>

        <div>
          <label htmlFor="ef-phone" className="label">Phone</label>
          <input
            id="ef-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
            maxLength={20}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="ef-pass" className="label">
            {existing ? 'New password (leave blank to keep current)' : 'Password'}
          </label>
          <input
            id="ef-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={existing ? 0 : 8}
            autoComplete="new-password"
            placeholder={existing ? 'Fill only if changing' : 'At least 8 characters'}
            className="input"
          />
          <p className="mt-1 text-xs text-ink-400">
            Must have 8+ characters, one letter and one number.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 accent-brand-600"
          />
          <span className="text-sm text-ink-700">Active (can log in)</span>
        </label>

        {error && <p className="field-error">{error}</p>}

        {!existing && (
          <p className="rounded-lg bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
            After creating an employee you must assign a restaurant, otherwise they will see
            nothing in their panel.
          </p>
        )}
      </form>
    </Modal>
  );
}

/* ================================================================= */
/*              ASSIGN / UNASSIGN RESTAURANTS                        */
/* ================================================================= */

function AssignRestaurantsModal({
  employee,
  restaurants,
  onClose,
  onChanged,
}: {
  employee: Employee;
  restaurants: { restaurantId: number; name: string; locality: string; city: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();

  const [restaurantId, setRestaurantId] = useState('');
  const [designation, setDesignation] = useState('Manager');
  const [canMenu, setCanMenu] = useState(true);
  const [canOrder, setCanOrder] = useState(true);
  const [canBooking, setCanBooking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  const assignments = useAsync(() => adminApi.employeeAssignments(employee.userId), [employee.userId]);

  /* designation badalne par default permissions lag jaate hain */
  const pickDesignation = (d: string) => {
    setDesignation(d);
    const defaults = DEFAULT_PERMISSIONS[d];
    if (defaults) {
      setCanMenu(defaults.menu);
      setCanOrder(defaults.order);
      setCanBooking(defaults.booking);
    }
  };

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!restaurantId) {
      setError('Please choose a restaurant.');
      return;
    }

    setBusy(true);

    try {
      const result = await adminApi.assignRestaurant({
        userId: employee.userId,
        restaurantId: Number(restaurantId),
        designation,
        canManageMenu: canMenu,
        canManageOrder: canOrder,
        canManageBooking: canBooking,
      });

      toast.success(result.message);
      setRestaurantId('');
      assignments.reload();
      onChanged();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
          ? err.detail
          : 'Could not assign.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (a: Assignment) => {
    setRemoving(a.restaurantId);
    try {
      await adminApi.unassignRestaurant(employee.userId, a.restaurantId);
      toast.success(`${a.restaurantName} hata diya.`);
      assignments.reload();
      onChanged();
    } catch (err) {
      toast.fromError(err, 'Could not remove it.');
    } finally {
      setRemoving(null);
    }
  };

  const assignedIds = new Set((assignments.data ?? []).map((a) => a.restaurantId));
  const available = restaurants.filter((r) => !assignedIds.has(r.restaurantId));

  return (
    <Modal
      open
      title={`${employee.fullName} - restaurant assignment`}
      onClose={onClose}
      size="lg"
      footer={
        <button type="button" onClick={onClose} className="btn-outline">
          Close
        </button>
      }
    >
      <div className="space-y-6">
        {/* ==================== current assignments ==================== */}
        <section>
          <h3 className="mb-2 text-sm font-bold tracking-wide text-ink-500 uppercase">
            Current assignments
          </h3>

          {assignments.error ? (
            <ErrorBanner message={assignments.error} onRetry={assignments.reload} />
          ) : assignments.isLoading ? (
            <RowsSkeleton rows={2} />
          ) : (assignments.data?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
              No restaurant assigned yet. Add one below.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {assignments.data!.map((a) => (
                <li key={a.assignmentId} className="rounded-xl border border-ink-200 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{a.restaurantName}</p>
                      <p className="text-xs text-ink-500">
                        {a.locality}, {a.city}
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge tone="blue">{a.designation}</Badge>
                        {a.canManageMenu && <Badge tone="green">Menu</Badge>}
                        {a.canManageOrder && <Badge tone="green">Orders</Badge>}
                        {a.canManageBooking && <Badge tone="green">Bookings</Badge>}
                        {!a.canManageMenu && !a.canManageOrder && !a.canManageBooking && (
                          <Badge tone="red">No permissions</Badge>
                        )}
                      </div>

                      {a.pendingOrders !== undefined && a.pendingOrders > 0 && (
                        <p className="mt-1.5 text-xs font-medium text-amber-700">
                          {a.pendingOrders} pending orders
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => unassign(a)}
                      disabled={removing === a.restaurantId}
                      className="btn-ghost btn-sm shrink-0 !text-brand-700"
                    >
                      {removing === a.restaurantId && <Spinner className="size-3.5" />}
                      Hatao
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ==================== new assignment ==================== */}
        <section className="rounded-xl border border-ink-200 bg-ink-50 p-4">
          <h3 className="mb-3 text-sm font-bold tracking-wide text-ink-500 uppercase">
            Assign a new restaurant
          </h3>

          {available.length === 0 ? (
            <p className="text-sm text-ink-500">
              All restaurants are already assigned. To change permissions, remove the assignment
              first and then assign it again.
            </p>
          ) : (
            <form onSubmit={assign} className="space-y-4">
              <div>
                <label htmlFor="ar-rest" className="label">Restaurant</label>
                <select
                  id="ar-rest"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  required
                  className="select"
                >
                  <option value="">Choose a restaurant</option>
                  {available.map((r) => (
                    <option key={r.restaurantId} value={r.restaurantId}>
                      {r.name} - {r.locality}, {r.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="label">Designation</span>
                <div className="flex flex-wrap gap-2">
                  {DESIGNATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pickDesignation(d)}
                      className={`chip ${designation === d ? 'chip-active' : ''}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-400">
                  Choosing a designation sets the permissions automatically - you can change them
                  below.
                </p>
              </div>

              <div>
                <span className="label">What can this employee do?</span>
                <div className="space-y-2">
                  <PermissionRow
                    label="Manage menu"
                    hint="Items add/edit, price, food image change, availability"
                    checked={canMenu}
                    onChange={setCanMenu}
                  />
                  <PermissionRow
                    label="Manage orders"
                    hint="Accept or reject orders, change status, assign delivery"
                    checked={canOrder}
                    onChange={setCanOrder}
                  />
                  <PermissionRow
                    label="Manage bookings"
                    hint="Confirm or reject table and hall bookings, edit halls"
                    checked={canBooking}
                    onChange={setCanBooking}
                  />
                </div>
              </div>

              {error && <p className="field-error">{error}</p>}

              <button type="submit" disabled={busy || !restaurantId} className="btn-primary w-full">
                {busy && <Spinner className="size-4" />}
                Assign restaurant
              </button>
            </form>
          )}
        </section>
      </div>
    </Modal>
  );
}

function PermissionRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 bg-white p-3 transition ${
        checked ? 'border-brand-500' : 'border-ink-200'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-brand-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-800">{label}</span>
        <span className="block text-xs text-ink-500">{hint}</span>
      </span>
    </label>
  );
}
