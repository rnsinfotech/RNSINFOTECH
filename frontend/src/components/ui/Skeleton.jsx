import React from "react";

/**
 * Skeleton — a single shimmering placeholder block. Compose with
 * width/height/radius props to match whatever it's standing in for.
 */
export function Skeleton({ width = "100%", height = 16, radius = 6, style = {}, className = "" }) {
  return (
    <span
      className={`rns-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** SkeletonText — a stack of skeleton lines, last line shorter by default. */
export function SkeletonText({ lines = 3, lastLineWidth = "60%", gap = 8 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? lastLineWidth : "100%"} />
      ))}
    </div>
  );
}

/** SkeletonProductCard — mirrors ProductCard's layout exactly. */
export function SkeletonProductCard() {
  return (
    <div className="rns-card" aria-hidden="true">
      <Skeleton height={0} radius={0} style={{ aspectRatio: "4 / 3", borderRadius: "10px 10px 0 0" }} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton width="40%" height={11} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="70%" height={14} />
        <div style={{ paddingTop: 8 }}>
          <Skeleton width="50%" height={18} />
        </div>
      </div>
    </div>
  );
}

/** SkeletonProductGrid — a full grid of card skeletons, for page-level loading. */
export function SkeletonProductGrid({ count = 6, columns = 3 }) {
  return (
    <div className={`rns-grid rns-grid--${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  );
}
