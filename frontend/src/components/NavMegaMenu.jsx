import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { products as allProducts } from "../data/siteData";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * NavMegaMenu — dropdown panel for a single category nav link. Content
 * (brand shortcuts + featured-product teasers) is derived from the
 * `products` array in siteData.js at render time rather than hardcoded
 * here, so it stays in sync automatically as the catalogue changes.
 */
export default function NavMegaMenu({ categoryId, categoryLabel, onNavigate }) {
  const inCategory = allProducts.filter((p) => p.categoryId === categoryId);
  const brandNames = [...new Set(inCategory.map((p) => p.brand))].slice(0, 5);
  const featured = [
    ...inCategory.filter((p) => p.tag === "featured"),
    ...inCategory.filter((p) => p.tag !== "featured"),
  ].slice(0, 2);

  if (inCategory.length === 0) return null;

  return (
    <div
      className="rns-mega-menu"
      style={{
        position: "absolute",
        top: "calc(100% + 1px)",
        left: 0,
        minWidth: 480,
        background: "#fff",
        border: "1px solid var(--rns-line)",
        borderRadius: 12,
        boxShadow: "0 20px 48px rgba(16,19,26,0.16)",
        padding: 20,
        display: "grid",
        gridTemplateColumns: "1fr 1.3fr",
        gap: 24,
        zIndex: 60,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--rns-ink-faint)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 10,
          }}
        >
          Shop by brand
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {brandNames.map((brand) => (
            <Link
              key={brand}
              to={`/products?category=${categoryId}&brand=${encodeURIComponent(brand)}`}
              onClick={onNavigate}
              style={{
                fontSize: 13.5,
                color: "var(--rns-ink)",
                padding: "7px 8px",
                borderRadius: 7,
              }}
              className="rns-mega-menu-link"
            >
              {brand}
            </Link>
          ))}
          <Link
            to={`/products?category=${categoryId}`}
            onClick={onNavigate}
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--rns-primary)",
              padding: "9px 8px 7px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            View all {categoryLabel}
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--rns-ink-faint)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 10,
          }}
        >
          Featured
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {featured.map((p) => (
            <Link
              key={p.id}
              to={`/products/${p.id}`}
              onClick={onNavigate}
              className="rns-mega-menu-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 8,
                borderRadius: 8,
                color: "var(--rns-ink)",
              }}
            >
              <img
                src={p.image}
                alt=""
                style={{ width: 44, height: 44, borderRadius: 7, objectFit: "cover", flexShrink: 0, background: "var(--rns-bg-alt)" }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--rns-ink-soft)", marginTop: 2 }}>{formatINR(p.price)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .rns-mega-menu-link:hover { background: var(--rns-bg-alt); }
      `}</style>
    </div>
  );
}
