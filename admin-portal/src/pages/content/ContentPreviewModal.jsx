import React from "react";

export default function ContentPreviewModal({ type, item, onClose }) {
  if (!item) return null;
  const policy = type === "policy" ? (item.draft || item) : null;
  const blog = type === "blog" ? item : null;
  const faq = type === "faq" ? item : null;
  const title = type === "faq" ? "FAQ preview" : type === "blog" ? "Blog preview" : "Policy preview";

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 860, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h3>{title}</h3>
            <div style={{ fontSize: 12, color: "var(--admin-ink-faint)", marginTop: 4 }}>Preview only — this does not publish content.</div>
          </div>
          <button className="admin-btn admin-btn--ghost admin-btn--sm" type="button" onClick={onClose}>Close</button>
        </div>

        {faq && (
          <div className="admin-card" style={{ boxShadow: "none" }}>
            <h2 style={{ marginBottom: 10 }}>{faq.q}</h2>
            <p style={{ color: "var(--admin-ink-soft)", lineHeight: 1.7 }}>{faq.a}</p>
          </div>
        )}

        {blog && (
          <article>
            {blog.coverImage && <img src={blog.coverImage} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 12, marginBottom: 18 }} />}
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--admin-primary)" }}>{blog.category}</div>
            <h1 style={{ margin: "8px 0" }}>{blog.title}</h1>
            <div style={{ fontSize: 12, color: "var(--admin-ink-faint)", marginBottom: 18 }}>{blog.author} · {blog.date || "Unscheduled"}</div>
            <p style={{ color: "var(--admin-ink-soft)", lineHeight: 1.65, marginBottom: 18 }}>{blog.excerpt}</p>
            <div style={{ display: "grid", gap: 14 }}>{blog.content.map((paragraph, index) => <p key={index} style={{ color: "var(--admin-ink-soft)", lineHeight: 1.75 }}>{paragraph}</p>)}</div>
          </article>
        )}

        {policy && (
          <article>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--admin-primary)" }}>Legal</div>
            <h1 style={{ margin: "8px 0" }}>Policy preview</h1>
            <div style={{ fontSize: 12, color: "var(--admin-ink-faint)", marginBottom: 14 }}>Last updated {policy.updated}</div>
            <div style={{ color: "var(--admin-ink-soft)", lineHeight: 1.75, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{policy.description || ""}</div>
          </article>
        )}
      </div>
    </div>
  );
}
