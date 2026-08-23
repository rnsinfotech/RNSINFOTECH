import React from "react";
import Icon from "./Icon";
import { getPasswordChecklist } from "../lib/authValidation";

const BAR_COLORS = ["#d64545", "#d64545", "#e08a2c", "#e08a2c", "#0a7a58", "#0a7a58"];

export default function PasswordStrength({ password }) {
  const checklist = getPasswordChecklist(password);
  const score = checklist.filter((r) => r.met).length;

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {checklist.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              background: i < score ? BAR_COLORS[score] : "var(--rns-line)",
            }}
          />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginTop: 10 }}>
        {checklist.map((rule) => (
          <div
            key={rule.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              color: rule.met ? "#0a7a58" : "var(--rns-ink-faint)",
            }}
          >
            <Icon name={rule.met ? "check" : "minus"} size={11} />
            {rule.label}
          </div>
        ))}
      </div>
    </div>
  );
}
