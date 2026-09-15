import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartLine, CartState, FoodItem } from '@/types';

const CART_KEY = 'fm_cart';

const EMPTY: CartState = {
  restaurantId: null,
  restaurantName: null,
  restaurantSlug: null,
  lines: [],
};

interface CartContextValue extends CartState {
  itemCount: number;
  subTotal: number;
  isEmpty: boolean;
  /** Item add karo. Doosre restaurant ka item ho to 'conflict' milta hai. */
  add(item: FoodItem, restaurant: { id: number; name: string; slug: string }): 'added' | 'conflict';
  /** Conflict ke baad cart clear karke naya item daalo */
  replaceWith(item: FoodItem, restaurant: { id: number; name: string; slug: string }): void;
  setQuantity(foodItemId: number, quantity: number): void;
  increment(foodItemId: number): void;
  decrement(foodItemId: number): void;
  remove(foodItemId: number): void;
  clear(): void;
  quantityOf(foodItemId: number): number;
  /** Re-order ke liye - poora cart ek saath set karo */
  loadLines(restaurant: { id: number; name: string; slug: string }, lines: CartLine[]): void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStored(): CartState {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw) as CartState;
    if (!Array.isArray(parsed.lines)) return EMPTY;

    // corrupt entries filter kar do
    const lines = parsed.lines.filter(
      (l) => typeof l.foodItemId === 'number' && typeof l.price === 'number' && l.quantity > 0,
    );

    return { ...parsed, lines };
  } catch {
    return EMPTY;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(() => readStored());

  useEffect(() => {
    try {
      if (state.lines.length === 0) localStorage.removeItem(CART_KEY);
      else localStorage.setItem(CART_KEY, JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [state]);

  const toLine = (item: FoodItem): CartLine => ({
    foodItemId: item.foodItemId,
    name: item.name,
    price: item.effectivePrice ?? item.price,
    imageUrl: item.imageUrl ?? null,
    isVeg: item.isVeg,
    quantity: 1,
  });

  const add = useCallback<CartContextValue['add']>((item, restaurant) => {
    let result: 'added' | 'conflict' = 'added';

    setState((prev) => {
      if (prev.restaurantId !== null && prev.restaurantId !== restaurant.id && prev.lines.length > 0) {
        result = 'conflict';
        return prev;
      }

      const existing = prev.lines.find((l) => l.foodItemId === item.foodItemId);

      const lines = existing
        ? prev.lines.map((l) =>
            l.foodItemId === item.foodItemId ? { ...l, quantity: Math.min(l.quantity + 1, 50) } : l,
          )
        : [...prev.lines, toLine(item)];

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        lines,
      };
    });

    return result;
  }, []);

  const replaceWith = useCallback<CartContextValue['replaceWith']>((item, restaurant) => {
    setState({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      lines: [toLine(item)],
    });
  }, []);

  const setQuantity = useCallback((foodItemId: number, quantity: number) => {
    setState((prev) => {
      const clamped = Math.max(0, Math.min(quantity, 50));
      const lines =
        clamped === 0
          ? prev.lines.filter((l) => l.foodItemId !== foodItemId)
          : prev.lines.map((l) => (l.foodItemId === foodItemId ? { ...l, quantity: clamped } : l));

      return lines.length === 0 ? EMPTY : { ...prev, lines };
    });
  }, []);

  const increment = useCallback(
    (id: number) => setState((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.foodItemId === id ? { ...l, quantity: Math.min(l.quantity + 1, 50) } : l,
      ),
    })),
    [],
  );

  const decrement = useCallback(
    (id: number) =>
      setState((prev) => {
        const lines = prev.lines
          .map((l) => (l.foodItemId === id ? { ...l, quantity: l.quantity - 1 } : l))
          .filter((l) => l.quantity > 0);

        return lines.length === 0 ? EMPTY : { ...prev, lines };
      }),
    [],
  );

  const remove = useCallback(
    (id: number) =>
      setState((prev) => {
        const lines = prev.lines.filter((l) => l.foodItemId !== id);
        return lines.length === 0 ? EMPTY : { ...prev, lines };
      }),
    [],
  );

  const clear = useCallback(() => setState(EMPTY), []);

  const loadLines = useCallback<CartContextValue['loadLines']>((restaurant, lines) => {
    setState({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      lines: lines.filter((l) => l.quantity > 0),
    });
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = state.lines.reduce((sum, l) => sum + l.quantity, 0);
    const subTotal = state.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

    return {
      ...state,
      itemCount,
      subTotal,
      isEmpty: state.lines.length === 0,
      add,
      replaceWith,
      setQuantity,
      increment,
      decrement,
      remove,
      clear,
      quantityOf: (id: number) => state.lines.find((l) => l.foodItemId === id)?.quantity ?? 0,
      loadLines,
    };
  }, [state, add, replaceWith, setQuantity, increment, decrement, remove, clear, loadLines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider.');
  return ctx;
}
