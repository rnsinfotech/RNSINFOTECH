import React from "react";
import { SectionHeader } from "./SectionHeader";
import Icon from "./Icon";
import Reveal from "./ui/Reveal";

function initialsOf(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Stars({ rating = 5 }) {
  return (
    <div style={{ display: "flex", gap: 2 }} aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon
          key={i}
          name="star"
          size={14}
          style={{ color: i < rating ? "#f5a623" : "var(--rns-line-strong)" }}
        />
      ))}
    </div>
  );
}

export default function Testimonials({ items = [] }) {
  return (
    <section className="rns-section">
      <div className="rns-container">
        <SectionHeader eyebrow="Customers" title="What IT managers say" />
        <div className="rns-grid rns-grid--3">
          {items.map((t, i) => (
            <Reveal key={t.name} delay={Math.min(i, 3)} style={{ height: "100%" }}>
              <div className="rns-card" style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Icon name="quote" size={20} className="rns-quote-icon" />
                  {t.rating && <Stars rating={t.rating} />}
                </div>
                <p style={{ marginTop: 16, fontSize: 14.5, color: "var(--rns-ink-soft)", lineHeight: 1.6, flex: 1 }}>
                  {t.quote}
                </p>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rns-line)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--rns-primary-tint)",
                      color: "var(--rns-primary-dark)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "var(--rns-font-display)",
                      flexShrink: 0,
                    }}
                  >
                    {initialsOf(t.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--rns-ink-faint)", marginTop: 2 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`.rns-quote-icon { color: var(--rns-line-strong); }`}</style>
    </section>
  );
}
