import React from "react";

export default function AuthField({ label, value, onChange, error, ...rest }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 6,
          border: `1px solid ${error ? "#d64545" : "var(--rns-line-strong)"}`,
          fontSize: 13.5,
          fontFamily: "var(--rns-font-body)",
        }}
        {...rest}
      />
      {error && <div style={{ fontSize: 11.5, color: "#d64545", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
