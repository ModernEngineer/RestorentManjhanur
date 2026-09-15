import { useEffect, useMemo, useState } from 'react';
import { adminApi, employeeApi } from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';

export interface ScopedRestaurant {
  restaurantId: number;
  name: string;
  city?: string;
  locality?: string;
  canManageMenu: boolean;
  canManageOrder: boolean;
  canManageBooking: boolean;
}

/**
 * Admin ko saare restaurants dikhte hain (full permissions),
 * employee ko sirf uske assigned restaurants - unhi permissions ke saath
 * jo admin ne di hain.
 *
 * Dono panels ke manage pages yahi hook use karte hain, isliye
 * scoping ek hi jagah likhi hai.
 */
export function useRestaurantScope() {
  const { isAdmin } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, error } = useAsync(
    async (): Promise<ScopedRestaurant[]> => {
      if (isAdmin) {
        const page = await adminApi.restaurants({ pageSize: 100, isActive: true });
        return page.items.map((r) => ({
          restaurantId: r.restaurantId,
          name: r.name,
          city: r.city,
          locality: r.locality,
          canManageMenu: true,
          canManageOrder: true,
          canManageBooking: true,
        }));
      }

      const assignments = await employeeApi.myRestaurants();
      return assignments.map((a) => ({
        restaurantId: a.restaurantId,
        name: a.restaurantName,
        city: a.city,
        locality: a.locality,
        canManageMenu: a.canManageMenu,
        canManageOrder: a.canManageOrder,
        canManageBooking: a.canManageBooking,
      }));
    },
    [isAdmin],
  );

  /* pehla restaurant auto-select */
  useEffect(() => {
    if (selectedId !== null || !data?.length) return;
    setSelectedId(data[0].restaurantId);
  }, [data, selectedId]);

  const selected = useMemo(
    () => data?.find((r) => r.restaurantId === selectedId) ?? null,
    [data, selectedId],
  );

  return {
    restaurants: data ?? [],
    selected,
    selectedId,
    setSelectedId,
    isLoading,
    error,
    isAdmin,
  };
}

/* ----------------------------------------------------------------- */

/** Restaurant chooser dropdown - manage pages ke top par lagta hai. */
export function scopeOptions(restaurants: ScopedRestaurant[]) {
  return restaurants.map((r) => ({
    value: r.restaurantId,
    label: r.locality ? `${r.name} - ${r.locality}` : r.name,
  }));
}
