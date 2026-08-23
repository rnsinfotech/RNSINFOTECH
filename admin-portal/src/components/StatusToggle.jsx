import React from "react";

// labels defaults to Active/Inactive (original behavior) — pass a custom
// { on, off } pair to reuse this control for other boolean toggles (e.g.
// Featured / Best Seller on the product form and list page).
export default function StatusToggle({ active, onChange, disabled, labels }) {
  const onLabel = labels?.on ?? "Active";
  const offLabel = labels?.off ?? "Inactive";
  return (
    <button
      type="button"
      className={`admin-toggle${active ? " is-on" : ""}`}
      onClick={() => onChange(!active)}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? `${onLabel} — click to switch to ${offLabel.toLowerCase()}` : `${offLabel} — click to switch to ${onLabel.toLowerCase()}`}
    >
      <span className="admin-toggle__track" />
      <span style={{ fontSize: 12, color: "var(--admin-ink-soft)", fontWeight: 600 }}>
        {active ? onLabel : offLabel}
      </span>
    </button>
  );
}
