import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const CompareContext = createContext(null);
const STORAGE_KEY = "rns_compare_v1";
const MAX_COMPARE = 4;

function loadInitialState() {
  if (typeof window === "undefined") return { items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "TOGGLE": {
      const { product } = action;
      const exists = state.items.some((i) => i.id === product.id);
      if (exists) {
        return { items: state.items.filter((i) => i.id !== product.id) };
      }
      if (state.items.length >= MAX_COMPARE) {
        // Reducer stays pure/silent on the cap — callers check `isFull`
        // beforehand (or read the unchanged state back) to surface a toast.
        return state;
      }
      // A pen display and a stylus don't share meaningful specs to line
      // up in a table, so the compare list is restricted to a single
      // category at a time — same silent-guard pattern as the cap above;
      // callers check `canCompare` beforehand to surface a toast instead.
      if (state.items.length > 0 && state.items[0].categoryId !== product.categoryId) {
        return state;
      }
      return {
        items: [
          ...state.items,
          {
            id: product.id,
            name: product.name,
            image: product.image,
            price: product.price,
            mrp: product.mrp,
            category: product.category,
            categoryId: product.categoryId,
            brand: product.brand,
          },
        ],
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.id !== action.id) };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

/**
 * CompareProvider — Phase 4 first pass. Tracks up to MAX_COMPARE products
 * (persisted to localStorage, same pattern as CartContext) so ProductCard
 * and ProductDetailPage can offer a "compare" toggle. A dedicated
 * side-by-side comparison view/page is deferred — see PROGRESS_NOTES.md —
 * this only ships the shared state + toggle affordance for now.
 */
export function CompareProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable (private browsing, quota) — list just won't persist
    }
  }, [state]);

  const api = useMemo(() => {
    const ids = new Set(state.items.map((i) => i.id));
    const compareCategoryId = state.items[0]?.categoryId ?? null;
    return {
      items: state.items,
      count: state.items.length,
      max: MAX_COMPARE,
      isFull: state.items.length >= MAX_COMPARE,
      isComparing: (id) => ids.has(id),
      // Lets callers (ProductCard, ProductDetailPage) check *before*
      // dispatching, so they can show the right toast — "list is full"
      // vs. "different category" — instead of the toggle silently no-op'ing.
      canCompare: (product) =>
        ids.has(product.id) ||
        (state.items.length < MAX_COMPARE &&
          (compareCategoryId === null || compareCategoryId === product.categoryId)),
      compareCategoryId,
      toggleCompare: (product) => dispatch({ type: "TOGGLE", product }),
      removeCompare: (id) => dispatch({ type: "REMOVE", id }),
      clearCompare: () => dispatch({ type: "CLEAR" }),
    };
  }, [state]);

  return <CompareContext.Provider value={api}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within a CompareProvider");
  return ctx;
}
