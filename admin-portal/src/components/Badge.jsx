import React from "react";

// tone maps to the semantic status tokens in styles/tokens.css. Every
// future phase (orders, payments, inventory, reviews) reuses this one
// component instead of each page inventing its own status pill.
const TONES = {
  success: { bg: "var(--admin-success-tint)", fg: "var(--admin-success)" },
  warning: { bg: "var(--admin-warning-tint)", fg: "var(--admin-warning)" },
  danger: { bg: "var(--admin-danger-tint)", fg: "var(--admin-danger)" },
  info: { bg: "var(--admin-info-tint)", fg: "var(--admin-info)" },
  neutral: { bg: "var(--admin-neutral-tint)", fg: "var(--admin-neutral)" },
};

export default function Badge({ tone = "neutral", children }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span className="admin-badge" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}
