import React from "react";
import { SectionHeader } from "./SectionHeader";
import Icon from "./Icon";
import Reveal from "./ui/Reveal";

export default function WhyChooseUs({ items = [], brandName = "RNS INFOTECH" }) {
  return (
    <section className="rns-section">
      <div className="rns-container">
        <SectionHeader
          eyebrow="Why choose us"
          title={`Why businesses stay with ${brandName}`}
        />
        <div className="rns-grid rns-grid--4">
          {items.map((f, i) => (
            <Reveal key={f.title} delay={Math.min(i, 3)} style={{ padding: "4px 0" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "var(--rns-primary-tint)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--rns-primary-dark)",
                }}
              >
                <Icon name={f.icon} size={22} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 16 }}>{f.title}</div>
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>{f.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
