import React from "react";

// A small, fixed palette so avatars stay in the site's tone instead of
// picking arbitrary hues — deterministic per-name so the same person
// always lands on the same color.
const PALETTE = ["#2f5233", "#8a3b2b", "#2b4a6f", "#6b3f7a", "#7a5a1e", "#1f6f5c"];

function initialsFor(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({ name, size = 44, style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colorFor(name || ""),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--rns-font-display)",
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
        ...style,
      }}
    >
      {initialsFor(name)}
    </div>
  );
}
