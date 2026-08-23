import React from "react";
import { SectionHeader } from "./SectionHeader";

export default function BlogPreview({ posts }) {
  return (
    <section id="blog" className="rns-section">
      <div className="rns-container">
        <SectionHeader
          eyebrow="Field notes"
          title="From the blog"
          action={{ label: "View all posts", href: "#" }}
        />
        <div className="rns-grid rns-grid--3">
          {posts.map((p) => (
            <a key={p.id} href="#" className="rns-card" style={{ padding: 24, display: "block" }}>
              <span className="rns-tag">{p.tag}</span>
              <h3 style={{ fontSize: 16.5, marginTop: 16, lineHeight: 1.35 }}>{p.title}</h3>
              <p style={{ marginTop: 10, fontSize: 14, color: "var(--rns-ink-soft)" }}>{p.excerpt}</p>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: "var(--rns-font-mono)",
                  fontSize: 12,
                  color: "var(--rns-ink-faint)",
                }}
              >
                {p.readTime}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
