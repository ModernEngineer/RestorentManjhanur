import { useState } from 'react';
import { manageApi } from '@/api/endpoints';
import ImagePicker from '@/components/ImagePicker';
import {
  Badge, ConfirmDialog, EmptyState, ErrorBanner, Modal, Pagination, RowsSkeleton,
  SafeImage, Spinner, VegMark,
} from '@/components/ui';
import { useLocationCtx } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useAsync, useDebounced, usePageTitle } from '@/hooks/useAsync';
import type { FoodItem } from '@/types';
import { scopeOptions, useRestaurantScope } from './useRestaurantScope';

/* ============================================================
   Menu management - Admin aur Employee dono ke liye.

   Yahan wo saare kaam hote hain jo aapne maange the:
     - naya item add / edit
     - FOOD IMAGE CHANGE (upload ya URL se)
     - available / out-of-stock toggle
     - single ya bulk discount
     - item delete (soft)
   ============================================================ */

export default function MenuManager() {
  usePageTitle('Menu management');

  const { currency } = useLocationCtx();
  const toast = useToast();
  const scope = useRestaurantScope();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [page, setPage] = useState(1);
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [showInactive, setShowInactive] = useState(false);

  const [editItem, setEditItem] = useState<FoodItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageItem, setImageItem] = useState<FoodItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<FoodItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const canManage = scope.selected?.canManageMenu ?? false;

  const items = useAsync(
    () =>
      scope.selectedId && canManage
        ? manageApi.menuItems({
            restaurantId: scope.selectedId,
            search: debouncedSearch || undefined,
            vegOnly: vegFilter === 'veg',
            nonVegOnly: vegFilter === 'nonveg',
            includeInactive: showInactive,
            pageNumber: page,
            pageSize: 20,
          })
        : Promise.resolve(null),
    [scope.selectedId, canManage, debouncedSearch, vegFilter, showInactive, page],
  );

  const categories = useAsync(
    () => (scope.selectedId ? manageApi.categories(scope.selectedId) : Promise.resolve([])),
    [scope.selectedId],
  );

  const toggleAvailability = async (item: FoodItem) => {
    try {
      await manageApi.toggleItemAvailability(item.foodItemId, !item.isAvailable);
      toast.success(
        item.isAvailable ? `${item.name} marked out of stock.` : `${item.name} marked available.`,
      );
      items.reload();
    } catch (err) {
      toast.fromError(err, 'Could not update.');
    }
  };

  const doDelete = async () => {
    if (!deleteItem) return;

    setDeleteBusy(true);
    try {
      await manageApi.deleteItem(deleteItem.foodItemId);
      toast.success(`${deleteItem.name} menu se hata diya.`);
      setDeleteItem(null);
      items.reload();
    } catch (err) {
      toast.fromError(err, 'Could not delete.');
    } finally {
      setDeleteBusy(false);
    }
  };

  /* ---------------- no restaurant assigned ---------------- */
  if (scope.isLoading) return <RowsSkeleton rows={4} />;

  if (scope.error) return <ErrorBanner message={scope.error} />;

  if (scope.restaurants.length === 0) {
    return (
      <EmptyState
        title="No restaurant assigned"
        description="Ask an admin to assign you a restaurant so you can manage its menu."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ---------------- header ---------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Menu management</h1>
          <p className="text-sm text-ink-500">
            Add items, change prices and update food images.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowBulk(true)}
            disabled={!canManage}
            className="btn-outline"
          >
            Bulk discount
          </button>

          <button
            type="button"
            onClick={() => {
              setEditItem(null);
              setShowForm(true);
            }}
            disabled={!canManage}
            className="btn-primary"
          >
            + New item
          </button>
        </div>
      </div>

      {/* ---------------- restaurant scope ---------------- */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-56 flex-1">
          <label htmlFor="mm-rest" className="label">
            Restaurant
          </label>
          <select
            id="mm-rest"
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

        <div className="min-w-48 flex-1">
          <label htmlFor="mm-search" className="label">
            Search items
          </label>
          <input
            id="mm-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Naam ya description"
            className="input"
          />
        </div>

        <div className="flex gap-2">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'veg', label: 'Veg' },
              { key: 'nonveg', label: 'Non-veg' },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                setVegFilter(v.key);
                setPage(1);
              }}
              className={`chip ${vegFilter === v.key ? 'chip-active' : ''}`}
            >
              {v.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setShowInactive((v) => !v);
              setPage(1);
            }}
            className={`chip ${showInactive ? 'chip-active' : ''}`}
          >
            Show deleted too
          </button>
        </div>
      </div>

      {/* ---------------- permission warning ---------------- */}
      {!canManage && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {scope.selected?.name} ka menu manage karne ki permission aapke paas nahi hai
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Admin se "Can manage menu" permission maango.
          </p>
        </div>
      )}

      {/* ---------------- items table ---------------- */}
      {canManage &&
        (items.error ? (
          <ErrorBanner message={items.error} onRetry={items.reload} />
        ) : items.isLoading ? (
          <RowsSkeleton rows={6} />
        ) : (items.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No items found"
            description={search ? 'Try changing the search text.' : 'This restaurant's menu is empty - add the first item.'}
            action={
              <button
                type="button"
                onClick={() => {
                  setEditItem(null);
                  setShowForm(true);
                }}
                className="btn-primary"
              >
                + New item
              </button>
            }
          />
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Rating</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.data!.items.map((it) => (
                      <tr key={it.foodItemId} className={it.isActive === false ? 'opacity-50' : ''}>
                        {/* ---- image (click karke change) ---- */}
                        <td>
                          <button
                            type="button"
                            onClick={() => setImageItem(it)}
                            className="group relative block size-14 cursor-pointer overflow-hidden rounded-lg bg-ink-100"
                            title="Change image"
                          >
                            <SafeImage src={it.imageUrl} alt={it.name} className="size-full object-cover" />
                            <span className="absolute inset-0 grid place-items-center bg-ink-900/60 opacity-0 transition group-hover:opacity-100">
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="size-5">
                                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </button>
                        </td>

                        {/* ---- name ---- */}
                        <td>
                          <div className="flex items-center gap-2">
                            <VegMark isVeg={it.isVeg} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink-900">{it.name}</p>
                              {it.isBestseller && <Badge tone="amber">Bestseller</Badge>}
                            </div>
                          </div>
                        </td>

                        <td className="text-xs text-ink-500">{it.categoryName ?? '-'}</td>

                        {/* ---- price ---- */}
                        <td>
                          <p className="font-semibold text-ink-900">{currency(it.effectivePrice)}</p>
                          {it.discountPrice !== null && it.discountPrice !== undefined && (
                            <p className="text-xs text-ink-400">
                              <span className="line-through">{currency(it.price)}</span>{' '}
                              <span className="font-semibold text-rating-500">-{it.discountPercent}%</span>
                            </p>
                          )}
                        </td>

                        <td className="text-xs">
                          {it.rating > 0 ? `${it.rating} (${it.totalReviews})` : '-'}
                        </td>

                        {/* ---- status ---- */}
                        <td>
                          {it.isActive === false ? (
                            <Badge tone="gray">Deleted</Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleAvailability(it)}
                              className="cursor-pointer"
                              title="Click to toggle"
                            >
                              <Badge tone={it.isAvailable ? 'green' : 'red'}>
                                {it.isAvailable ? 'Available' : 'Out of stock'}
                              </Badge>
                            </button>
                          )}
                        </td>

                        {/* ---- actions ---- */}
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setImageItem(it)}
                              className="btn-outline btn-sm"
                              title="Change image"
                            >
                              Image
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditItem(it);
                                setShowForm(true);
                              }}
                              className="btn-outline btn-sm"
                            >
                              Edit
                            </button>
                            {it.isActive !== false && (
                              <button
                                type="button"
                                onClick={() => setDeleteItem(it)}
                                className="btn-ghost btn-sm !text-brand-700"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              pageNumber={items.data!.pageNumber}
              totalPages={items.data!.totalPages}
              totalCount={items.data!.totalCount}
              onChange={setPage}
            />
          </>
        ))}

      {/* ==================== item form ==================== */}
      {showForm && scope.selectedId && (
        <ItemForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          restaurantId={scope.selectedId}
          existing={editItem}
          categories={categories.data ?? []}
          onSaved={() => {
            setShowForm(false);
            setEditItem(null);
            items.reload();
          }}
        />
      )}

      {/* ==================== IMAGE CHANGE ==================== */}
      {imageItem && (
        <ImagePicker
          open={imageItem !== null}
          onClose={() => setImageItem(null)}
          title={`${imageItem.name} - change image`}
          currentUrl={imageItem.imageUrl}
          onUpload={async (file) => {
            const res = await manageApi.uploadItemImage(imageItem.foodItemId, file);
            return res.imageUrl;
          }}
          onSetUrl={async (url) => {
            await manageApi.updateItemImageUrl(imageItem.foodItemId, url);
          }}
          onSaved={() => {
            setImageItem(null);
            items.reload();
          }}
        />
      )}

      {/* ==================== bulk discount ==================== */}
      {showBulk && scope.selectedId && (
        <BulkDiscountModal
          open={showBulk}
          onClose={() => setShowBulk(false)}
          restaurantId={scope.selectedId}
          categories={categories.data ?? []}
          onApplied={() => {
            setShowBulk(false);
            items.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteItem !== null}
        title="Delete this item?"
        message={`"${deleteItem?.name}" will be removed from the menu. Past orders keep their record, so reports are unaffected.`}
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
/*                          ITEM FORM                                */
/* ================================================================= */

function ItemForm({
  open,
  onClose,
  restaurantId,
  existing,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: number;
  existing: FoodItem | null;
  categories: { categoryId: number; name: string }[];
  onSaved: () => void;
}) {
  const toast = useToast();

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing?.price?.toString() ?? '');
  const [discountPrice, setDiscountPrice] = useState(existing?.discountPrice?.toString() ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId?.toString() ?? '');
  const [isVeg, setIsVeg] = useState(existing?.isVeg ?? true);
  const [isBestseller, setIsBestseller] = useState(existing?.isBestseller ?? false);
  const [isAvailable, setIsAvailable] = useState(existing?.isAvailable ?? true);
  const [serves, setServes] = useState(existing?.servesCount ?? '');
  const [displayOrder, setDisplayOrder] = useState(existing?.displayOrder?.toString() ?? '0');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const p = Number(price);
    const dp = discountPrice.trim() ? Number(discountPrice) : null;

    if (!Number.isFinite(p) || p <= 0) {
      setError('Price must be greater than 0.');
      return;
    }

    if (dp !== null && (!Number.isFinite(dp) || dp >= p)) {
      setError('The discount price must be lower than the normal price.');
      return;
    }

    setBusy(true);

    try {
      const result = await manageApi.saveMenuItem({
        foodItemId: existing?.foodItemId ?? 0,
        restaurantId,
        categoryId: categoryId ? Number(categoryId) : null,
        name: name.trim(),
        description: description.trim() || null,
        price: p,
        discountPrice: dp,
        imageUrl: imageUrl.trim() || null,
        isVeg,
        isBestseller,
        isAvailable,
        servesCount: serves.trim() || null,
        displayOrder: Number(displayOrder) || 0,
        isActive: true,
      });

      toast.success(result.message === 'Saved' ? 'Item saved.' : result.message);
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
      title={existing ? `Edit ${existing.name}` : 'New menu item'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="item-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            Item save karo
          </button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="if-name" className="label">Item ka naam</label>
          <input
            id="if-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={150}
            placeholder="e.g. Butter Chicken"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="if-desc" className="label">Description</label>
          <textarea
            id="if-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="Chhota description jo customer ko dikhega"
            className="input resize-y"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="if-price" className="label">Price (Rs)</label>
            <input
              id="if-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min={1}
              step={1}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="if-dprice" className="label">Discount price (optional)</label>
            <input
              id="if-dprice"
              type="number"
              value={discountPrice}
              onChange={(e) => setDiscountPrice(e.target.value)}
              min={0}
              step={1}
              placeholder="Leave blank for no discount"
              className="input"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="if-cat" className="label">Category</label>
            <select
              id="if-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="select"
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="if-serves" className="label">Serves (optional)</label>
            <input
              id="if-serves"
              value={serves}
              onChange={(e) => setServes(e.target.value)}
              maxLength={40}
              placeholder="e.g. Serves 1-2"
              className="input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="if-img" className="label">Image URL (optional)</label>
          <input
            id="if-img"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            maxLength={500}
            placeholder="https://..."
            className="input"
          />
          <p className="mt-1 text-xs text-ink-400">
            To upload a file, save the item and then use the "Image" button in the list.
          </p>
        </div>

        <div>
          <span className="label">Veg ya non-veg?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsVeg(true)}
              className={`chip ${isVeg ? 'chip-active' : ''}`}
            >
              <VegMark isVeg /> Veg
            </button>
            <button
              type="button"
              onClick={() => setIsVeg(false)}
              className={`chip ${!isVeg ? 'chip-active' : ''}`}
            >
              <VegMark isVeg={false} /> Non-veg
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="size-4 accent-brand-600"
            />
            <span className="text-sm text-ink-700">Available</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={isBestseller}
              onChange={(e) => setIsBestseller(e.target.checked)}
              className="size-4 accent-brand-600"
            />
            <span className="text-sm text-ink-700">Bestseller</span>
          </label>

          <div>
            <label htmlFor="if-order" className="label">Display order</label>
            <input
              id="if-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              min={0}
              className="input"
            />
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}

/* ================================================================= */
/*                       BULK DISCOUNT                               */
/* ================================================================= */

function BulkDiscountModal({
  open,
  onClose,
  restaurantId,
  categories,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: number;
  categories: { categoryId: number; name: string }[];
  onApplied: () => void;
}) {
  const toast = useToast();
  const { currency } = useLocationCtx();

  const [percent, setPercent] = useState(10);
  const [categoryId, setCategoryId] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setError(null);
    setBusy(true);

    try {
      const result = await manageApi.bulkDiscount({
        restaurantId,
        categoryId: categoryId ? Number(categoryId) : undefined,
        discountPercent: percent,
        maxPrice: maxPrice.trim() ? Number(maxPrice) : undefined,
      });

      toast.success(
        percent === 0
          ? `${result.affectedItems} items se discount hata diya.`
          : `${percent}% discount applied to ${result.affectedItems} items.`,
      );
      onApplied();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'detail' in err && typeof err.detail === 'string'
          ? err.detail
          : 'Could not apply the discount.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Bulk discount"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={apply} className="btn-primary" disabled={busy}>
            {busy && <Spinner className="size-4" />}
            {percent === 0 ? 'Discount hatao' : `Apply ${percent}% discount`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          This sets the discount price on many items at once.
          <strong> Setting 0% removes the discount.</strong>
        </p>

        <div>
          <label htmlFor="bd-pct" className="label">
            Discount percent: <strong>{percent}%</strong>
          </label>
          <input
            id="bd-pct"
            type="range"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            min={0}
            max={70}
            step={5}
            className="w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-400">
            <span>0% (hatao)</span>
            <span>70%</span>
          </div>
        </div>

        <div>
          <label htmlFor="bd-cat" className="label">Kis category par?</label>
          <select
            id="bd-cat"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="select"
          >
            <option value="">Poore menu par</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                Sirf {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bd-max" className="label">Sirf itne price tak ke items (optional)</label>
          <input
            id="bd-max"
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            min={0}
            placeholder="e.g. 500"
            className="input"
          />
          <p className="mt-1 text-xs text-ink-400">
            Khaali chhodo to sab items par lagega. {currency(500)} dene par sirf {currency(500)} tak ke items.
          </p>
        </div>

        {error && <p className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
