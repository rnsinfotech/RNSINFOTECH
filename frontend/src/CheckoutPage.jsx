import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import AddressForm from "./components/AddressForm";
import { useCart } from "./context/CartContext";
import { useOrders } from "./context/OrdersContext";
import { useAddresses } from "./context/AddressContext";
import { DELIVERY_ESTIMATE_LABEL, DELIVERY_ESTIMATE_TEXT } from "./lib/delivery";
import { getCheckoutQuote } from "./lib/api";

import { nav, footer } from "./data/siteData";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * CheckoutPage — the "order details" mid page between a cart/Order
 * Now click and the confirmed order, mirroring the Amazon-style flow
 * that was asked for:
 *
 *   - Reached from CartPage ("Checkout", mode: "cart") or directly
 *     from ProductDetailPage ("Order now", mode: "buy-now") — either
 *     way it just receives an `items` array via router state, so a
 *     buy-now purchase never touches the cart at all.
 *   - Address and payment method live here, not on the cart — the
 *     cart only ever holds products.
 *   - Address comes from the saved address book (AddressContext /
 *     ProfilePage), with an inline "add new address" fallback.
 *   - Delivery is not a customer choice: every order ships standard,
 *     3-4 days, shown as a fixed line rather than a picker.
 *   - Payment is online-only (Razorpay) — no cash on delivery, no "pay
 *     later" at checkout. The order is only created here as a
 *     reserved/pending record so stock can be held; it is not
 *     considered placed until PaymentPage confirms the payment.
 */
export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { placeOrder } = useOrders();
  const { addresses, defaultId, addAddress } = useAddresses();

  const items = location.state?.items || [];
  const mode = location.state?.mode || "cart"; // "cart" | "buy-now"

  // Delivery is fixed (3-4 days, standard) and payment is online-only —
  // neither is a user-facing choice anymore, and the backend no longer
  // accepts a delivery method at all.

  const [selectedAddressId, setSelectedAddressId] = useState(defaultId || addresses[0]?.id || null);
  const [addingAddress, setAddingAddress] = useState(addresses.length === 0);
  const [formError, setFormError] = useState("");
  const [placing, setPlacing] = useState(false);

  // Coupon (Phase BC). This card only ever shows a *preview* discount —
  // the real, binding application happens server-side inside placeOrder
  // (see lib/coupons.js and OrdersContext.jsx). couponInput is the raw
  // text field; appliedCoupon is only set once /coupons/validate has
  // actually confirmed a code.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount }
  const [couponStatus, setCouponStatus] = useState("idle"); // idle | checking | error
  const [couponError, setCouponError] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState("");

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const clientSubtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const mrpTotal = items.reduce((sum, i) => sum + (i.mrp || i.price) * i.qty, 0);
  const savings = Math.max(0, mrpTotal - clientSubtotal);

  const subtotal = Number(quote?.subtotal ?? clientSubtotal);
  const shipping = Number(quote?.shippingFee ?? 0);
  const deliveryFee = Number(quote?.deliveryFee ?? 0);
  const couponDiscount = Number(quote?.discount ?? appliedCoupon?.discount ?? 0);
  const tax = Number(quote?.tax ?? 0);
  const total = Number(quote?.total ?? 0);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  async function refreshQuote(couponCode = appliedCoupon?.code) {
    if (!items.length) return;
    setQuoteLoading(true);
    setQuoteError("");
    try {
      const response = await getCheckoutQuote({
        items,
        couponCode,
      });
      setQuote(response?.quote || null);
    } catch (err) {
      setQuote(null);
      setQuoteError(err.message || "Could not calculate the current checkout total.");
    } finally {
      setQuoteLoading(false);
    }
  }

  useEffect(() => {
    refreshQuote();
    // Coupon application/removal calls refreshQuote explicitly so invalid
    // codes can be surfaced; this effect just covers cart contents changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (items.length === 0) {
    return (
      <>
        <SEO title="Nothing to check out" noindex />
        <AnnouncementBar />
        <Navbar {...nav} />
        <section className="rns-section">
          <div className="rns-container" style={{ textAlign: "center", padding: "60px 0" }}>
            <h1 className="rns-section-title">Nothing to check out</h1>
            <p style={{ marginTop: 10, color: "var(--rns-ink-soft)" }}>
              Head back to your cart or pick a product to order.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <Link to="/cart" className="rns-btn rns-btn--primary">
                Go to cart
              </Link>
              <Link to="/products" className="rns-btn rns-btn--ghost">
                Browse products
              </Link>
            </div>
          </div>
        </section>
        <Footer logo={nav.logo} {...footer} />
      </>
    );
  }

  async function handleSaveNewAddress(addr) {
    try {
      const saved = await addAddress(addr);
      setSelectedAddressId(saved.id);
      setAddingAddress(false);
      setFormError("");
    } catch (err) {
      setFormError(err.message || "Could not save that address. Please try again.");
    }
  }

  // Coupon application and the visible checkout total both come from the
  // same backend quote endpoint. The browser never calculates the discount.
  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponStatus("checking");
    setCouponError("");
    try {
      const response = await getCheckoutQuote({
        items,
        couponCode: code,
      });
      const nextQuote = response?.quote;
      if (!nextQuote) throw new Error("The checkout quote was empty.");
      setQuote(nextQuote);
      setAppliedCoupon({ code: nextQuote.couponCode, discount: nextQuote.discount });
      setCouponStatus("idle");
    } catch (err) {
      setAppliedCoupon(null);
      setCouponStatus("error");
      setCouponError(err.message || "That coupon code isn't valid.");
      await refreshQuote(null);
    }
  }

  async function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponStatus("idle");
    setCouponError("");
    await refreshQuote(null);
  }

  // Places the real Order via POST /api/orders. The backend independently
  // re-prices products, coupon, shipping, delivery and tax before creating
  // the order. For online payment, PaymentPage then starts Razorpay against
  // that persisted server-calculated final amount.
  async function handleConfirm() {
    if (!selectedAddress) {
      setFormError("Select or add a delivery address to continue.");
      return;
    }
    setFormError("");
    setPlacing(true);

    try {
      const order = await placeOrder({
        items,
        shippingAddress: selectedAddress,
        couponCode: appliedCoupon?.code,
      });

      // The quote is advisory until order creation. The backend recalculates
      // again. Never proceed to payment with two different displayed totals.
      if (Number(order.total) !== Number(total)) {
        setQuote({
          ...(quote || {}),
          subtotal: order.subtotal,
          discount: order.discount,
          shippingFee: order.shipping,
          deliveryFee: order.deliveryFee,
          tax: order.tax,
          total: order.total,
        });
        setFormError("The price changed while checking out. The updated server total is now shown below. Please review and continue again.");
        return;
      }

      if (mode === "cart") clearCart();

      // Online payment only — the order record just created is a
      // reservation, not a placed order. It's only actually placed once
      // PaymentPage confirms the Razorpay payment.
      navigate("/checkout/payment", { state: { orderId: order.id, mode } });
    } catch (err) {
      setFormError(err.message || "Something went wrong placing your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <>
      <SEO title="Checkout" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">{mode === "buy-now" ? "Buy now" : "Checkout"}</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Order details
          </h1>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        <div className="rns-checkout-layout">
          <div style={{ display: "grid", gap: 18 }}>
            {/* Address */}
            <div className="rns-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="mapPin" size={16} style={{ color: "var(--rns-ink-soft)" }} />
                  <h2 style={{ fontSize: 15, fontFamily: "var(--rns-font-display)", fontWeight: 600 }}>
                    Delivery address
                  </h2>
                </div>
                {!addingAddress && addresses.length > 0 && (
                  <button onClick={() => setAddingAddress(true)} className="rns-btn rns-btn--ghost" style={{ padding: "6px 10px", fontSize: 12 }}>
                    <Icon name="plus" size={13} />
                    Add new
                  </button>
                )}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      border: `1px solid ${selectedAddressId === addr.id ? "var(--rns-ink)" : "var(--rns-line)"}`,
                      borderRadius: "var(--rns-r-sm)",
                      padding: "12px 14px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === addr.id}
                      onChange={() => {
                        setSelectedAddressId(addr.id);
                        setFormError("");
                      }}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 600 }}>{addr.name} · {addr.phone}</div>
                      <div style={{ color: "var(--rns-ink-soft)" }}>{addr.line1}</div>
                      <div style={{ color: "var(--rns-ink-soft)" }}>
                        {[addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  </label>
                ))}

                {addingAddress ? (
                  <div style={{ border: "1px solid var(--rns-line)", borderRadius: "var(--rns-r-sm)", padding: 16, marginTop: addresses.length ? 4 : 0 }}>
                    <AddressForm
                      saveLabel="Save and use this address"
                      onCancel={addresses.length > 0 ? () => setAddingAddress(false) : undefined}
                      onSave={handleSaveNewAddress}
                    />
                  </div>
                ) : (
                  addresses.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--rns-ink-soft)" }}>Add a delivery address to continue.</p>
                  )
                )}

                {formError && <div style={{ fontSize: 12.5, color: "#d64545" }}>{formError}</div>}
              </div>

              <div style={{ marginTop: 12 }}>
                <Link to="/profile" style={{ fontSize: 12.5, color: "var(--rns-primary)" }}>
                  Manage saved addresses →
                </Link>
              </div>
            </div>

            {/* Delivery — fixed for every order, not a customer choice */}
            <div className="rns-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="calendar" size={16} style={{ color: "var(--rns-ink-soft)" }} />
                <h2 style={{ fontSize: 15, fontFamily: "var(--rns-font-display)", fontWeight: 600 }}>
                  Delivery
                </h2>
              </div>
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  border: "1px solid var(--rns-line)",
                  borderRadius: "var(--rns-r-sm)",
                  padding: "12px 14px",
                }}
              >
                <Icon name="truck" size={16} style={{ color: "var(--rns-ink-soft)", marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{DELIVERY_ESTIMATE_LABEL}</div>
                  <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                    {DELIVERY_ESTIMATE_TEXT} for every order, no matter the address.
                  </div>
                </div>
              </div>
            </div>

            {/* Payment method — online only, no COD, no pay-later */}
            <div className="rns-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="creditCard" size={16} style={{ color: "var(--rns-ink-soft)" }} />
                <h2 style={{ fontSize: 15, fontFamily: "var(--rns-font-display)", fontWeight: 600 }}>
                  Payment method
                </h2>
              </div>
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  border: "1px solid var(--rns-ink)",
                  borderRadius: "var(--rns-r-sm)",
                  padding: "12px 14px",
                }}
              >
                <Icon name="shield" size={16} style={{ color: "var(--rns-ink-soft)", marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Pay online</div>
                  <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                    UPI, cards, and net banking via Razorpay. Cash on delivery isn't available — your
                    order is placed only once payment is confirmed.
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Link to={mode === "cart" ? "/cart" : "/products"} style={{ fontSize: 13.5, color: "var(--rns-primary)" }}>
                ← {mode === "cart" ? "Back to cart" : "Continue shopping"}
              </Link>
            </div>
          </div>

          {/* Order summary */}
          <div>
            <div className="rns-card" style={{ padding: 22, position: "sticky", top: 88 }}>
              <h2 style={{ fontSize: 16, fontFamily: "var(--rns-font-display)", fontWeight: 600 }}>
                Order summary
              </h2>

              <div style={{ marginTop: 16, display: "grid", gap: 12, maxHeight: 260, overflowY: "auto" }}>
                {items.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", background: "var(--rns-bg-alt)", flexShrink: 0 }}>
                      {item.image && (
                        <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                      <div style={{ color: "var(--rns-ink-faint)" }}>Qty {item.qty}</div>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{formatINR(item.price * item.qty)}</div>
                  </div>
                ))}
              </div>

              {/* Coupon (Phase BC) */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--rns-line)" }}>
                {appliedCoupon ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      background: "var(--rns-bg-alt)",
                      borderRadius: "var(--rns-r-sm)",
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <Icon name="tag" size={14} style={{ color: "#0a7a58" }} />
                      <span>
                        <strong>{appliedCoupon.code}</strong> applied — you save {formatINR(appliedCoupon.discount)}
                      </span>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="rns-btn rns-btn--ghost"
                      style={{ padding: "4px 8px", fontSize: 11.5 }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value);
                          if (couponStatus === "error") {
                            setCouponStatus("idle");
                            setCouponError("");
                          }
                        }}
                        placeholder="Coupon code"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: "1px solid var(--rns-line)",
                          borderRadius: "var(--rns-r-sm)",
                          padding: "8px 10px",
                          fontSize: 12.5,
                          textTransform: "uppercase",
                        }}
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={!couponInput.trim() || couponStatus === "checking"}
                        className="rns-btn rns-btn--ghost"
                        style={{ padding: "8px 14px", fontSize: 12.5, whiteSpace: "nowrap", opacity: couponStatus === "checking" ? 0.7 : 1 }}
                      >
                        {couponStatus === "checking" ? "Checking..." : "Apply"}
                      </button>
                    </div>
                    {couponStatus === "error" && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--rns-danger, #c0392b)" }}>{couponError}</div>
                    )}
                  </>
                )}
              </div>

              <div style={{ marginTop: 18, display: "grid", gap: 10, fontSize: 13.5, paddingTop: 14, borderTop: "1px solid var(--rns-line)" }}>
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
                {couponDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--rns-ink-soft)" }}>Coupon ({appliedCoupon.code})</span>
                    <span style={{ color: "#0a7a58" }}>-{formatINR(couponDiscount)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--rns-ink-soft)" }}>Shipping</span>
                  <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--rns-ink-soft)" }}>{DELIVERY_ESTIMATE_LABEL}</span>
                    <span>{formatINR(deliveryFee)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--rns-ink-soft)" }}>Tax</span>
                    <span>{formatINR(tax)}</span>
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

              {quoteError && (
                <div style={{ marginTop: 14, color: "#b42318", fontSize: 13 }}>
                  {quoteError}
                </div>
              )}
              {quote && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--rns-ink-faint)" }}>
                  Final amount calculated by the server{quoteLoading ? "…" : ""}.
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={placing || quoteLoading || !quote}
                className="rns-btn rns-btn--primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 20, opacity: placing ? 0.7 : 1 }}
              >
                {placing ? "Placing order..." : "Continue to payment"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12, color: "var(--rns-ink-faint)" }}>
                <Icon name="shield" size={14} />
                100% genuine products, authorized dealer
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        .rns-checkout-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 40px;
          align-items: start;
        }
        @media (max-width: 800px) {
          .rns-checkout-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
