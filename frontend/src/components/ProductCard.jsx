import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { useCompare } from "../context/CompareContext";
import { useToast } from "../context/ToastContext";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

export default function ProductCard({ product }) {
  const { id, name, category, price, mrp, stock, image, tags = [], isFeatured, isBestSeller } = product;
  const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : null;
  // Best Seller / Featured (curated booleans) take priority over a
  // freeform tag when there's only room for one badge on the card.
  const badgeLabel = isBestSeller ? "Best seller" : isFeatured ? "Featured" : tags[0] || null;

  const { isComparing, toggleCompare, isFull, compareCategoryId } = useCompare();
  const toast = useToast();
  const comparing = isComparing(id);

  function handleCompareClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!comparing && isFull) {
      toast.info("You can compare up to 4 products at a time.");
      return;
    }
    if (!comparing && compareCategoryId && compareCategoryId !== product.categoryId) {
      toast.info("You can only compare products from the same category.");
      return;
    }
    toggleCompare(product);
    toast.success(comparing ? `Removed ${name} from compare` : `Added ${name} to compare`);
  }

  return (
    <Link
      to={`/products/${id}`}
      className="rns-card"
      style={{ display: "flex", flexDirection: "column", color: "inherit", height: "100%" }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          background: "var(--rns-bg-alt)",
          borderBottom: "1px solid var(--rns-line)",
          borderRadius: "10px 10px 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--rns-ink-faint)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={handleCompareClick}
          aria-label={comparing ? `Remove ${name} from compare` : `Add ${name} to compare`}
          aria-pressed={comparing}
          title={comparing ? "Remove from compare" : "Add to compare"}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1,
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            border: "1px solid var(--rns-line)",
            background: comparing ? "var(--rns-ink)" : "rgba(255,255,255,0.92)",
            color: comparing ? "#fff" : "var(--rns-ink-soft)",
            cursor: "pointer",
          }}
        >
          <Icon name="compare" size={14} />
        </button>
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <Icon name="chip" size={30} />
        )}
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--rns-font-mono)",
            fontSize: 11,
            color: "var(--rns-ink-faint)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {category}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.35 }}>{name}</div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", gap: 8, paddingTop: 8 }}>
          <span style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 17 }}>
            {formatINR(price)}
          </span>
          {mrp && mrp > price && (
            <span style={{ fontSize: 13, color: "var(--rns-ink-faint)", textDecoration: "line-through" }}>
              {formatINR(mrp)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          {stock === "out-of-stock" ? (
            <span className="rns-tag" style={{ color: "#b3261e", borderColor: "#f3c9c5", background: "#fdf0ef" }}>
              Out of stock
            </span>
          ) : badgeLabel ? (
            <span className="rns-tag">{badgeLabel}</span>
          ) : (
            <span />
          )}
          {discount && (
            <span style={{ fontSize: 12, color: "var(--rns-primary)", fontWeight: 500, marginLeft: "auto" }}>
              -{discount}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
