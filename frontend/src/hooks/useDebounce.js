import { useEffect, useState } from "react";

/**
 * useDebounce — returns a value that only updates after `delay` ms of
 * no further changes. Used for the products search box so we don't
 * re-filter/re-render on every keystroke.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
