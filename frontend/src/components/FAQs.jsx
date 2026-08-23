import React, { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import Icon from "./Icon";

function FAQItem({ q, a, open, onToggle }) {
  return (
    <div style={{ borderBottom: "1px solid var(--rns-line)" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: "20px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "left",
          gap: 16,
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 15.5, fontWeight: 500 }}>{q}</span>
        <Icon
          name="chevron"
          size={16}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Grid-rows trick: animating 0fr -> 1fr is GPU-friendly and doesn't
          require measuring scrollHeight in JS, so there's no jump/jank
          on open — unlike the old instant conditional render. */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.25s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <p
            style={{
              margin: 0,
              paddingBottom: 20,
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--rns-ink-soft)",
              maxWidth: 760,
            }}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FAQs({ items }) {
  // Start with nothing expanded — defaulting to 0 here made the first FAQ
  // look permanently "clicked" open on every page load.
  const [openIndex, setOpenIndex] = useState(-1);

  return (
    <section id="faqs" className="rns-section rns-section--alt">
      <div className="rns-container" style={{ width: "100%" }}>
        <SectionHeader eyebrow="Support" title="Frequently asked questions" />
        <div
          className="rns-faq-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            columnGap: 48,
          }}
        >
          {items.map((f, i) => (
            <FAQItem
              key={f.q}
              q={f.q}
              a={f.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .rns-faq-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
