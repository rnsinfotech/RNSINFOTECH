import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import Button from "./components/Button";
import SEO from "./components/SEO";
import { EmptyState } from "./components/ui/Stateviews";

import { nav, footer } from "./data/siteData";
import { apiRequest, normalizeProduct } from "./lib/api";
import { useCompare } from "./context/CompareContext";
import { useCart } from "./context/CartContext";
import { useToast } from "./context/ToastContext";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * ComparePage — the side-by-side view CompareContext (Phase 4) and the
 * navbar's CompareAffordance (Phase 5) were both building toward.
 *
 * `useCompare().items` only stores a small snapshot per product
 * (id/name/image/price/mrp/category/categoryId/brand — enough for
 * ProductCard's toggle button to work without importing the full catalogue).
 * That's not enough for a *useful* comparison (no specs/stock/rating), so
 * this page fetches each item's full record live from GET /products/:id
 * (the catalogue endpoint accepts either a slug or a Mongo _id). If a
 * product was ever removed from the catalogue, the stored snapshot is
 * used as a fallback so the compare list doesn't just silently drop it.
 */
export default function ComparePage() {
  const { items, removeCompare, clearCompare } = useCompare();
  const { addItem } = useCart();
  const toast = useToast();
  const [liveById, setLiveById] = useState({});

  useEffect(() => {
    let ignore = false;
    Promise.all(
      items.map((item) =>
        apiRequest(`/products/${encodeURIComponent(item.id)}`)
          .then((res) => [item.id, normalizeProduct(res.product)])
          .catch(() => null)
      )
    ).then((entries) => {
      if (ignore) return;
      setLiveById(Object.fromEntries(entries.filter(Boolean)));
    });
    return () => {
      ignore = true;
    };
  }, [items]);

  const rows = useMemo(
    () => items.map((item) => liveById[item.id] || item),
    [items, liveById]
  );

  const hasAnySpecs = useMemo(() => rows.some((r) => (r.specs || []).length > 0), [rows]);

  function handleAddToCart(row) {
    addItem(row, 1);
    toast.success(`Added ${row.name} to cart`);
  }

  return (
    <>
      <SEO title="Compare products" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="rns-eyebrow">Side by side</span>
            <h1 className="rns-section-title" style={{ marginTop: 8 }}>
              Compare products
            </h1>
            <p style={{ marginTop: 10, fontSize: 14, color: "var(--rns-ink-soft)", maxWidth: 560 }}>
              {rows.length > 0
                ? `Comparing ${rows.length} product${rows.length === 1 ? "" : "s"} — add up to 4 from any product page or card.`
                : "Add products to compare from any product card or product page — up to 4 at a time."}
            </p>
          </div>
          {rows.length > 0 && (
            <Button variant="ghost" onClick={clearCompare}>
              Clear all
            </Button>
          )}
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        {rows.length === 0 ? (
          <EmptyState
            icon="compare"
            title="Nothing to compare yet"
            message="Tap the compare icon on any product card or product page to add it here."
            action={{ label: "Browse products", href: "/products" }}
          />
        ) : (
          <div className="rns-compare-scroll" style={{ overflowX: "auto" }}>
            <table className="rns-compare-table" style={{ width: "100%", minWidth: 560 + rows.length * 40, borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th style={{ width: 180 }} />
                  {rows.map((r) => (
                    <th key={r.id} style={{ padding: "0 12px 16px", textAlign: "left", verticalAlign: "top", minWidth: 200 }}>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => removeCompare(r.id)}
                          aria-label={`Remove ${r.name} from compare`}
                          title="Remove"
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            border: "1px solid var(--rns-line)",
                            background: "rgba(255,255,255,0.92)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Icon name="close" size={12} />
                        </button>
                        <Link to={`/products/${r.id}`} style={{ display: "block", color: "inherit" }}>
                          <div
                            style={{
                              aspectRatio: "4 / 3",
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "var(--rns-bg-alt)",
                              border: "1px solid var(--rns-line)",
                            }}
                          >
                            {r.image && (
                              <img src={r.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            )}
                          </div>
                          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{r.name}</div>
                        </Link>
                        <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 16 }}>
                            {formatINR(r.price)}
                          </span>
                          {r.mrp && r.mrp > r.price && (
                            <span style={{ fontSize: 12, color: "var(--rns-ink-faint)", textDecoration: "line-through" }}>
                              {formatINR(r.mrp)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="primary"
                          onClick={() => handleAddToCart(r)}
                          style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
                        >
                          Add to cart
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid var(--rns-line)" }}>
                  <td style={{ padding: "12px 12px 12px 0", color: "var(--rns-ink-faint)", fontWeight: 500 }}>Category</td>
                  {rows.map((r) => (
                    <td key={r.id} style={{ padding: 12 }}>{r.category}</td>
                  ))}
                </tr>
                {rows.some((r) => "stock" in r) && (
                  <tr style={{ borderTop: "1px solid var(--rns-line)" }}>
                    <td style={{ padding: "12px 12px 12px 0", color: "var(--rns-ink-faint)", fontWeight: 500 }}>Availability</td>
                    {rows.map((r) => (
                      <td key={r.id} style={{ padding: 12 }}>
                        {r.stock === "out-of-stock" ? (
                          <span className="rns-tag" style={{ color: "#b3261e", borderColor: "#f3c9c5", background: "#fdf0ef" }}>
                            Out of stock
                          </span>
                        ) : r.stock ? (
                          "Available to order"
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                  </tr>
                )}
                {rows.some((r) => "rating" in r) && (
                  <tr style={{ borderTop: "1px solid var(--rns-line)" }}>
                    <td style={{ padding: "12px 12px 12px 0", color: "var(--rns-ink-faint)", fontWeight: 500 }}>Rating</td>
                    {rows.map((r) => (
                      <td key={r.id} style={{ padding: 12 }}>
                        {r.rating ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Icon name="star" size={13} style={{ color: "#e0a92b" }} />
                            {r.rating.toFixed(1)}
                            <span style={{ color: "var(--rns-ink-faint)" }}>({r.reviewCount})</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                  </tr>
                )}
                {hasAnySpecs && (
                  <tr style={{ borderTop: "1px solid var(--rns-line)" }}>
                    <td style={{ padding: "12px 12px 12px 0", color: "var(--rns-ink-faint)", fontWeight: 500, verticalAlign: "top" }}>Specifications</td>
                    {rows.map((r) => (
                      <td key={r.id} style={{ padding: 12, verticalAlign: "top" }}>
                        {r.specs?.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                            {r.specs.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
