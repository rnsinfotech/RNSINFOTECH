import React, { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import { useOrders, getOrderStatus, getTrackingInfo, canDownloadInvoice } from "./context/OrdersContext";

import { downloadInvoice } from "./lib/invoice";
import { ErrorState } from "./components/ui/Stateviews";

import { nav, footer } from "./data/siteData";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

function formatDateTime(d) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * OrderDetailPage — the full picture for a single order: a tracking
 * timeline (derived live from OrdersContext.getOrderStatus, no server
 * needed), every line item, the delivery address, payment summary,
 * and an invoice download. Reused for any order via the :orderId
 * route param, same pattern as ProductDetailPage.
 */
export default function OrderDetailPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const { getOrder, getOrderById, cancelOrder } = useOrders();
  const cachedOrder = getOrder(orderId);
  const [order, setOrder] = useState(cachedOrder);
  const [actionBusy, setActionBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const justPlaced = Boolean(location.state?.justPlaced);

  useEffect(() => {
    let alive = true;
    getOrderById(orderId).then((fresh) => alive && setOrder(fresh)).catch((error) => alive && setLoadError(error));
    return () => { alive = false; };
  // Backend is the source of truth; this refresh runs once per order id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!order) {
    if (loadError && loadError.status !== 404) {
      return (
        <>
          <SEO title="Unable to load order" noindex />
          <AnnouncementBar />
          <Navbar {...nav} />
          <section className="rns-section"><div className="rns-container" style={{ padding: "60px 0" }}><ErrorState message={loadError.message} /></div></section>
          <Footer logo={nav.logo} {...footer} />
        </>
      );
    }
    return (
      <>
        <SEO title="Order not found" noindex />
        <AnnouncementBar />
        <Navbar {...nav} />
        <section className="rns-section">
          <div className="rns-container" style={{ textAlign: "center", padding: "60px 0" }}>
            <h1 className="rns-section-title">Order not found</h1>
            <p style={{ marginTop: 10, color: "var(--rns-ink-soft)" }}>
              We couldn't find an order with that ID.
            </p>
            <Link to="/orders" className="rns-btn rns-btn--primary" style={{ marginTop: 24 }}>
              Back to your orders
            </Link>
          </div>
        </section>
        <Footer logo={nav.logo} {...footer} />
      </>
    );
  }

  const status = getOrderStatus(order);
  const tracking = getTrackingInfo(order);
  const addr = order.shippingAddress || {};

  return (
    <>
      <SEO title="Order details" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <div className="rns-container" style={{ paddingTop: 22 }}>
        <nav aria-label="Breadcrumb" style={{ display: "flex", gap: 6, fontSize: 13, color: "var(--rns-ink-faint)" }}>
          <Link to="/" style={{ color: "var(--rns-ink-faint)" }}>Home</Link>
          <span>/</span>
          <Link to="/orders" style={{ color: "var(--rns-ink-faint)" }}>Your orders</Link>
          <span>/</span>
          <span style={{ color: "var(--rns-ink-soft)" }}>{order.id}</span>
        </nav>
      </div>

      {justPlaced && (
        <section className="rns-container" style={{ paddingTop: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--rns-signal-tint)",
              color: "#0a7a58",
              border: "1px solid transparent",
              borderRadius: "var(--rns-r-sm)",
              padding: "12px 16px",
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            <Icon name="check" size={16} />
            Order placed successfully — a confirmation has been sent to your email.
          </div>
        </section>
      )}

      {/* Return requests removed — admin's job ends at "shipped" and
          there's no post-shipment state to request a return from
          anymore (see PROGRESS_ORDER_SIMPLIFICATION.md). */}
      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div
          className="rns-container"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <span className="rns-eyebrow">Order {order.id}</span>
            <h1 className="rns-section-title" style={{ marginTop: 8 }}>
              {status.currentStage.label}
            </h1>
            <p style={{ marginTop: 8, fontSize: 13.5, color: "var(--rns-ink-soft)" }}>
              Placed on {formatDateTime(order.date)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* No "Pay now" branch — GET /orders hard-filters on
                paymentVerifiedAt, so every order reaching this page is
                already paid; see storefront-backend's listMyOrders. */}
            {canDownloadInvoice(order) ? (
              <button onClick={() => downloadInvoice(order)} className="rns-btn rns-btn--ghost">
                <Icon name="download" size={16} />
                Download invoice
              </button>
            ) : (
              <div
                title="Available once your order has shipped"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--rns-ink-faint)",
                  border: "1px solid var(--rns-line)",
                  borderRadius: "var(--rns-r-sm)",
                  padding: "10px 16px",
                }}
              >
                <Icon name="download" size={15} />
                Invoice available after your order ships
              </div>
            )}
            {["pending", "confirmed"].includes(order.status) && (
              <button
                onClick={async () => {
                  setActionBusy(true);
                  try { setOrder(await cancelOrder(order.id)); } catch (err) { window.alert(err.message || "Cancellation failed."); }
                  finally { setActionBusy(false); }
                }}
                className="rns-btn rns-btn--ghost"
                disabled={actionBusy}
              >
                {actionBusy ? "Processing…" : "Cancel order"}
              </button>
            )}
          </div>
        </div>
      </section>

      {status.isCancelled && (
        <section className="rns-container" style={{ paddingBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: status.isRefunded ? "#fdf2e3" : "#fdecec",
              color: status.isRefunded ? "#9a6300" : "#c0392b",
              borderRadius: "var(--rns-r-sm)",
              padding: "12px 16px",
              fontSize: 13.5,
            }}
          >
            <Icon name="alert" size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>
                {status.isRefunded ? "This order was refunded" : "This order was cancelled"}
              </div>
              {status.isRefunded && (
                <div style={{ marginTop: 2, fontSize: 12.5 }}>
                  Your payment was captured but couldn't be completed, so it was refunded automatically. It can take 5-7 working days to reflect in your bank account.
                </div>
              )}
              {status.cancelReason && (
                <div style={{ marginTop: 2, fontSize: 12.5 }}>{status.cancelReason}</div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tracking timeline */}
      {!status.isCancelled && !status.isTerminal && (
      <section className="rns-container" style={{ paddingBottom: tracking ? 20 : 40 }}>
        <div className="rns-card" style={{ padding: "28px 24px" }}>
          <div className="rns-tracking-track">
            {status.stages.map((stage, i) => (
              <div key={stage.key} className="rns-tracking-step">
                <div
                  className="rns-tracking-dot"
                  style={{
                    background: stage.complete ? "var(--rns-ink)" : "var(--rns-bg)",
                    borderColor: stage.complete ? "var(--rns-ink)" : "var(--rns-line-strong)",
                    color: stage.complete ? "#fff" : "var(--rns-ink-faint)",
                  }}
                >
                  {stage.complete ? <Icon name="check" size={13} /> : null}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{stage.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                  {stage.complete ? formatDateTime(stage.date) : "Pending"}
                </div>
                {i < status.stages.length - 1 && (
                  <div
                    className="rns-tracking-line"
                    style={{ background: status.stages[i + 1].complete ? "var(--rns-ink)" : "var(--rns-line)" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Once shipped, RNS INFOTECH's part is done — the courier takes it
          from here, so hand the customer the courier name + tracking ID
          instead of continuing to show an internal delivery timeline. */}
      {tracking && (
        <section className="rns-container" style={{ paddingBottom: 40 }}>
          <div
            className="rns-card"
            style={{
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              background: "var(--rns-bg-alt)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--rns-ink)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="truck" size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Your parcel is with {tracking.courierName}</div>
                <div style={{ fontSize: 12.5, color: "var(--rns-ink-soft)", marginTop: 2 }}>
                  RNS INFOTECH has handed this order off — track delivery directly with the courier from here.
                </div>
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--rns-font-mono)",
                fontSize: 13,
                background: "var(--rns-bg)",
                border: "1px solid var(--rns-line)",
                borderRadius: "var(--rns-r-sm)",
                padding: "10px 14px",
                whiteSpace: "nowrap",
              }}
            >
              Tracking ID: <strong>{tracking.trackingId}</strong>
            </div>
          </div>
        </section>
      )}

      {/* Items + summary */}
      <section className="rns-container" style={{ paddingBottom: 64 }}>
        <div className="rns-order-detail-layout">
          <div style={{ display: "grid", gap: 14 }}>
            <h2 className="rns-section-title" style={{ fontSize: 18 }}>
              Items in this order
            </h2>
            {order.items.map((item) => (
              <div key={item.id} className="rns-card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <Link
                  to={`/products/${item.id}`}
                  style={{ width: 72, height: 72, borderRadius: "var(--rns-r-sm)", overflow: "hidden", background: "var(--rns-bg-alt)", flexShrink: 0 }}
                >
                  {item.image ? (
                    <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--rns-font-mono)", fontSize: 11, color: "var(--rns-ink-faint)", textTransform: "uppercase" }}>
                    {item.category}
                  </div>
                  <Link to={`/products/${item.id}`} style={{ fontSize: 14, fontWeight: 500, display: "block", marginTop: 2 }}>
                    {item.name}
                  </Link>
                  <div style={{ fontSize: 12.5, color: "var(--rns-ink-soft)", marginTop: 6 }}>
                    Qty {item.qty} × {formatINR(item.price)}
                  </div>
                  {status.isShipped && (
                    <Link
                      to={`/products/${item.id}#reviews`}
                      className="rns-btn rns-btn--ghost"
                      style={{ fontSize: 12, padding: "5px 10px", marginTop: 8, display: "inline-flex" }}
                    >
                      <Icon name="star" size={12} />
                      Write a review
                    </Link>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {formatINR(item.price * item.qty)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            {/* Delivery address */}
            <div className="rns-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="mapPin" size={16} style={{ color: "var(--rns-ink-soft)" }} />
                <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Delivery address</h3>
              </div>
              <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--rns-ink-soft)", lineHeight: 1.7 }}>
                <div style={{ color: "var(--rns-ink)", fontWeight: 500 }}>{addr.name}</div>
                <div>{addr.line1}</div>
                <div>{[addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</div>
                <div>Phone: {addr.phone}</div>
              </div>
            </div>

            {/* Payment summary */}
            <div className="rns-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="creditCard" size={16} style={{ color: "var(--rns-ink-soft)" }} />
                <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Payment</h3>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--rns-ink-soft)" }}>
                {order.paymentMethod}
              </div>
              <div style={{ marginTop: 16, display: "grid", gap: 8, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--rns-ink-soft)" }}>Subtotal</span>
                  <span>{formatINR(order.subtotal)}</span>
                </div>
                {order.savings > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--rns-ink-soft)" }}>Savings</span>
                    <span style={{ color: "#0a7a58" }}>-{formatINR(order.savings)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--rns-ink-soft)" }}>
                      Coupon{order.couponCode ? ` (${order.couponCode})` : ""}
                    </span>
                    <span style={{ color: "#0a7a58" }}>-{formatINR(order.discount)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--rns-ink-soft)" }}>Shipping</span>
                  <span>{order.shipping === 0 ? "Free" : formatINR(order.shipping)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                    paddingTop: 10,
                    borderTop: "1px solid var(--rns-line)",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  <span>Total</span>
                  <span>{formatINR(order.total)}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, textAlign: "center", fontSize: 12.5, color: "var(--rns-ink-faint)" }}>
              Problem with this order?{" "}
              <Link to="/help" style={{ color: "var(--rns-primary)" }}>
                Get help
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        .rns-order-detail-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 40px;
          align-items: start;
        }
        .rns-tracking-track {
          display: flex;
          justify-content: space-between;
        }
        .rns-tracking-step {
          position: relative;
          flex: 1;
          text-align: center;
          padding: 0 4px;
        }
        .rns-tracking-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }
        .rns-tracking-line {
          position: absolute;
          top: 13px;
          left: 50%;
          width: 100%;
          height: 2px;
          z-index: 0;
        }
        @media (max-width: 760px) {
          .rns-order-detail-layout { grid-template-columns: 1fr !important; }
          .rns-tracking-track { flex-direction: column; gap: 20px; align-items: flex-start; }
          .rns-tracking-step { text-align: left; display: flex; align-items: center; gap: 12px; padding: 0; }
          .rns-tracking-line { display: none; }
        }
      `}</style>
    </>
  );
}
