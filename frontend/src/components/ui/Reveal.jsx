import React from "react";
import { useInView } from "../../hooks/useInView";

/**
 * Reveal — wraps a section and fades/slides it up the first time it
 * scrolls into view. Respects prefers-reduced-motion via the
 * .rns-animate-in CSS rule itself (no JS branching needed). Purely
 * presentational — pass `as` to change the wrapper element.
 */
export default function Reveal({ children, as = "div", delay = 0, className = "", ...rest }) {
  const [ref, inView] = useInView();
  const Tag = as;
  const delayClass = delay ? ` rns-animate-in--delay-${delay}` : "";
  return (
    <Tag ref={ref} className={`${inView ? "rns-animate-in" + delayClass : "rns-reveal-pending"} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
