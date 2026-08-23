import React from "react";
import { SectionHeader } from "./SectionHeader";
import Icon from "./Icon";
import Reveal from "./ui/Reveal";

export default function Solutions({ items = [] }) {
  return (
    <section id="solutions" className="rns-section rns-section--alt">
      <div className="rns-container">
        <SectionHeader
          eyebrow="Solutions"
          title="Solutions by need, not just by product"
          subtitle="Most orders are a project, not a single SKU. Here's how we typically scope them."
        />
        <div className="rns-grid rns-grid--3">
          {items.map((s, i) => (
            <Reveal key={s.title} delay={Math.min(i, 3)} style={{ height: "100%" }}>
              <div className="rns-card" style={{ padding: 24, height: "100%" }}>
                <Icon name={s.icon} size={22} />
                <div style={{ fontWeight: 600, fontSize: 16, marginTop: 16 }}>{s.title}</div>
                <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
