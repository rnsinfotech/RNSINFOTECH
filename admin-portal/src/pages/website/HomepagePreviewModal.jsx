import React from "react";

export default function HomepagePreviewModal({ website, onClose }) {
  if (!website) return null;
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 900, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h3>Homepage preview</h3>
            <div style={{ fontSize: 12, color: "var(--admin-ink-faint)", marginTop: 4 }}>Draft preview — customers only see the published version.</div>
          </div>
          <button className="admin-btn admin-btn--ghost admin-btn--sm" type="button" onClick={onClose}>Close</button>
        </div>
        <section className="admin-card" style={{ boxShadow: "none", background: "var(--admin-neutral-tint)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--admin-primary)" }}>Hero</div>
          <h1 style={{ margin: "8px 0" }}>{website.hero?.title}</h1>
          <p style={{ color: "var(--admin-ink-soft)", lineHeight: 1.6 }}>{website.hero?.subtitle}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {(website.hero?.stats || []).map((stat, i) => <span key={i} className="admin-badge">{stat.value} · {stat.label}</span>)}
          </div>
        </section>
        <section className="admin-card" style={{ boxShadow: "none", marginTop: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--admin-primary)" }}>Promotion</div>
          <h2 style={{ margin: "8px 0" }}>{website.promo?.title}</h2>
          <p style={{ color: "var(--admin-ink-soft)", lineHeight: 1.6 }}>{website.promo?.body}</p>
        </section>
        <section style={{ marginTop: 18 }}>
          <h3>Why choose us</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginTop: 10 }}>
            {(website.whyChooseUs || []).map((item) => <div key={item.id} className="admin-card" style={{ boxShadow: "none" }}><strong>{item.title}</strong><p style={{ fontSize: 12.5, color: "var(--admin-ink-soft)", marginTop: 5 }}>{item.body}</p></div>)}
          </div>
        </section>
        <section style={{ marginTop: 18 }}>
          <h3>Testimonials</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
            {(website.testimonials || []).map((item) => <div key={item.id} className="admin-card" style={{ boxShadow: "none" }}><strong>{item.name}</strong><p style={{ fontSize: 12.5, color: "var(--admin-ink-soft)", marginTop: 5 }}>&ldquo;{item.quote}&rdquo;</p></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
