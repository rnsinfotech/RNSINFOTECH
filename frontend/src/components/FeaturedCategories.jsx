import React from "react";
import { Link } from "react-router-dom";
import { SectionHeader } from "./SectionHeader";
import Icon from "./Icon";
import Reveal from "./ui/Reveal";

export default function FeaturedCategories({ categories = [] }) {
  return (
    <section id="categories" className="rns-section">
      <div className="rns-container">
        <SectionHeader
          eyebrow="Catalogue"
          title="Shop by category"
          subtitle="Every category is stocked and quoted with business volume in mind."
        />
        <div className="rns-grid rns-grid--6">
          {categories.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i, 3)} style={{ height: "100%" }}>
              <Link
                to={`/products?category=${c.id}`}
                className="rns-card rns-category-card"
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  height: "100%",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "4 / 3",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "var(--rns-bg-alt)",
                  }}
                >
                  <img
                    src={c.image}
                    alt={c.name}
                    loading="lazy"
                    className="rns-category-img"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      transition: "transform 0.25s ease",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Icon name={c.icon} size={18} style={{ color: "var(--rns-primary)", flexShrink: 0 }} />
                  <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`.rns-category-card:hover .rns-category-img { transform: scale(1.06); }`}</style>
    </section>
  );
}
