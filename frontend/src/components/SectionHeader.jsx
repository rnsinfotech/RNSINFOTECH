import React from "react";
import { Link } from "react-router-dom";
import Button from "./Button";

/**
 * SectionHeader — every section uses this so labeling stays
 * consistent site-wide: a mono eyebrow, a display title, an
 * optional supporting line, and an optional right-aligned action.
 * Internal (same-origin, path-starting) hrefs render as a router
 * <Link> for client-side navigation; anything else falls back to <a>.
 */
export function SectionHeader({ eyebrow, title, subtitle, action }) {
  const isInternal = action?.href?.startsWith("/");
  return (
    <div className="rns-section-head">
      <div className="rns-section-head__text">
        <span className="rns-eyebrow">{eyebrow}</span>
        <h2 className="rns-section-title">{title}</h2>
        {subtitle && <p className="rns-section-sub">{subtitle}</p>}
      </div>
      {action && (
        <Button
          variant="text"
          icon="arrowRight"
          as={isInternal ? Link : "a"}
          to={isInternal ? action.href : undefined}
          href={!isInternal ? action.href || "#" : undefined}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Trace — the site's one signature motif: a thin hairline with a
 * few inline "nodes", standing in for a circuit trace. Used as a
 * quiet divider between sections instead of animation or shadow.
 */
export function Trace({ nodes = 3 }) {
  const positions = Array.from({ length: nodes }, (_, i) => ((i + 1) / (nodes + 1)) * 100);
  return (
    <div className="rns-trace" aria-hidden="true">
      {positions.map((left, i) => (
        <span key={i} className="rns-trace__node" style={{ left: `${left}%` }} />
      ))}
    </div>
  );
}
