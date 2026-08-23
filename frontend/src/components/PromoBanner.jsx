import React from "react";
import Button from "./Button";

export default function PromoBanner({ eyebrow, title, body, cta }) {
  return (
    <section className="rns-container" style={{ padding: "0 24px" }}>
      <div
        style={{
          border: "1px solid var(--rns-line)",
          borderRadius: "var(--rns-r-lg)",
          background: "var(--rns-gradient-ink)",
          color: "#fff",
          padding: "36px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <span
            className="rns-eyebrow"
            style={{ color: "#9ba3b5" }}
          >
            {eyebrow}
          </span>
          <h2 style={{ color: "#fff", fontSize: "clamp(22px, 2.6vw, 28px)", marginTop: 10 }}>
            {title}
          </h2>
          <p style={{ color: "#b7bdc9", marginTop: 10, fontSize: 15 }}>{body}</p>
        </div>
        <Button as="a" href={cta.href} variant="primary" style={{ background: "#fff", color: "var(--rns-ink)" }}>
          {cta.label}
        </Button>
      </div>
    </section>
  );
}
