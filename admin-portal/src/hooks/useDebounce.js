import { useEffect, useState } from "react";

/**
 * useDebounce — returns a value that only updates after `delay` ms of
 * no further changes. Used by the topbar global search so we don't
 * hit the API on every keystroke.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
