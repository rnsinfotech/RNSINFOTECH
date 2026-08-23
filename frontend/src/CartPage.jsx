import React from "react";
import { Link, useNavigate } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import { useCart } from "./context/CartContext";

import { nav, footer } from "./data/siteData";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * CartPage — reads entirely from CartContext (backed by localStorage),
 * so it stays in sync with whatever was added from ProductDetailPage.
 * Each line supports quantity edits and removal; the summary panel
 * totals everything live as the cart changes.
 *
 * The cart only ever holds products — no address or payment method
 * lives here. "Checkout" hands the current cart items off to
 * CheckoutPage (the shared order-details step used by both the cart
 * and "Order now"), which is where address and online payment happen
 * (delivery is fixed for every order — 3-4 days — so it's not a
 * choice made here or there).
 */
export default function CartPage() {
  const { items, itemCount, subtotal, savings, removeItem, setQty } = useCart();
  const navigate = useNavigate();

  const shipping = subtotal > 0 && subtotal < 5000 ? 199 : 0;
  const total = subtotal + shipping;

  function handleCheckout() {
    navigate("/checkout", { state: { items, mode: "cart" } });
  }

  return (
    <>
      <SEO title="Your cart" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">Your cart</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            {itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"} in your cart` : "Your cart is empty"}
          </h1>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        {items.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--rns-line)",
              borderRadius: 12,
              padding: "64px 24px",
              textAlign: "center",
            }}
          >
            <Icon name="cart" size={32} className="rns-cart-empty-icon" />
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 16 }}>
              Nothing here yet
            </div>
            <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>
              Browse the catalogue and add a pen tablet, display, or stylus to get started.
            </p>
            <Link to="/products" className="rns-btn rns-btn--primary" style={{ marginTop: 20 }}>
              Browse products
            </Link>
          </div>
        ) : (
          <div className="rns-cart-layout">
            {/* Line items */}
            <div style={{ display: "grid", gap: 14 }}>
              {items.map((item) => {
                const lineTotal = item.price * item.qty;
                const lineDiscount =
                  item.mrp && item.mrp > item.price
                    ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
                    : null;

                return (
                  <div
                    key={item.id}
                    className="rns-card rns-cart-item"
                    style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}
                  >
                    <Link
                      to={`/products/${item.id}`}
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: "var(--rns-r-sm)",
                        overflow: "hidden",
                        background: "var(--rns-bg-alt)",
                        flexShrink: 0,
                        display: "block",
                      }}
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rns-ink-faint)" }}>
                          <Icon name="chip" size={22} />
                        </div>
                      )}
                    </Link>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--rns-font-mono)",
                          fontSize: 11,
                          color: "var(--rns-ink-faint)",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {item.category}
                      </div>
                      <Link
                        to={`/products/${item.id}`}
                        style={{ fontSize: 14.5, fontWeight: 500, display: "block", marginTop: 2 }}
                      >
                        {item.name}
                      </Link>

                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                        <span style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 15 }}>
                          {formatINR(item.price)}
                        </span>
                        {lineDiscount && (
                          <>
                            <span style={{ fontSize: 12.5, color: "var(--rns-ink-faint)", textDecoration: "line-through" }}>
                              {formatINR(item.mrp)}
                            </span>
                            <span style={{ fontSize: 11.5, color: "#0a7a58", fontWeight: 600 }}>
                              -{lineDiscount}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: "1px solid var(--rns-line-strong)",
                          borderRadius: "var(--rns-r-sm)",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          onClick={() => setQty(item.id, item.qty - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          style={{
                            width: 30,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "none",
                            border: "none",
                          }}
                        >
                          <Icon name="minus" size={12} />
                        </button>
                        <span
                          style={{
                            width: 28,
                            textAlign: "center",
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "var(--rns-font-mono)",
                          }}
                        >
                          {item.qty}
                        </span>
                        <button
                          onClick={() => setQty(item.id, item.qty + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          style={{
                            width: 30,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "none",
                            border: "none",
                          }}
                        >
                          <Icon name="plus" size={12} />
                        </button>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatINR(lineTotal)}
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="rns-btn rns-btn--text"
                        style={{ fontSize: 12.5, color: "var(--rns-ink-faint)" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              <div>
                <Link to="/products" style={{ fontSize: 13.5, color: "var(--rns-primary)" }}>
                  ← Continue shopping
                </Link>
              </div>
            </div>

            {/* Order summary */}
            <div>
              <div
                className="rns-card"
                style={{ padding: 22, position: "sticky", top: 88 }}
              >
                <h2 style={{ fontSize: 16, fontFamily: "var(--rns-font-display)", fontWeight: 600 }}>
                  Order summary
                </h2>

                <div style={{ marginTop: 18, display: "grid", gap: 10, fontSize: 13.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--rns-ink-soft)" }}>
                      Subtotal ({itemCount} item{itemCount === 1 ? "" : "s"})
                    </span>
                    <span>{formatINR(subtotal)}</span>
                  </div>
                  {savings > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--rns-ink-soft)" }}>Savings</span>
                      <span style={{ color: "#0a7a58" }}>-{formatINR(savings)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--rns-ink-soft)" }}>Shipping</span>
                    <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
                  </div>
                  {shipping > 0 && (
                    <div style={{ fontSize: 12, color: "var(--rns-ink-faint)" }}>
                      Add {formatINR(5000 - subtotal)} more for free shipping
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginTop: 18,
                    paddingTop: 18,
                    borderTop: "1px solid var(--rns-line)",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
                  <span style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 20 }}>
                    {formatINR(total)}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  className="rns-btn rns-btn--primary"
                  style={{ width: "100%", justifyContent: "center", marginTop: 20 }}
                >
                  Checkout
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12, color: "var(--rns-ink-faint)" }}>
                  <Icon name="shield" size={14} />
                  100% genuine products, authorized dealer
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        .rns-cart-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 40px;
          align-items: start;
        }
        .rns-cart-empty-icon { color: var(--rns-ink-faint); }
        @media (max-width: 800px) {
          .rns-cart-layout { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .rns-cart-item { flex-wrap: wrap; }
        }
      `}</style>
    </>
  );
}
