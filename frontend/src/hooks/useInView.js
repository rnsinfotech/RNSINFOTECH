import { useEffect, useRef, useState } from "react";

/**
 * useInView — true once the element has scrolled into the viewport.
 * Fires once (unobserves after first intersection) so re-scrolling
 * past a section doesn't replay the animation. Falls back to `true`
 * immediately if IntersectionObserver isn't available.
 */
export function useInView({ threshold = 0.15, rootMargin = "0px 0px -40px 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(node);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}
