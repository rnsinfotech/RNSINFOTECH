import React from "react";
import Icon from "./Icon";

export default function StatCard({ label, value, delta, deltaDirection = "up", icon }) {
  const deltaColor =
    deltaDirection === "up" ? "var(--admin-success)" : deltaDirection === "down" ? "var(--admin-danger)" : "var(--admin-ink-faint)";

  return (
    <div className="admin-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 12.5, color: "var(--admin-ink-soft)", fontWeight: 600 }}>{label}</div>
        {icon && (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--rns-primary-tint)",
              color: "var(--rns-primary-dark)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name={icon} size={15} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 25, fontWeight: 700, fontFamily: "var(--rns-font-display)", margin: "8px 0 4px" }}>
        {value}
      </div>
      {delta && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: deltaColor }}>
          {deltaDirection !== "flat" && (
            <Icon name={deltaDirection === "up" ? "arrowUp" : "arrowDown"} size={12} />
          )}
          {delta}
        </div>
      )}
    </div>
  );
}
