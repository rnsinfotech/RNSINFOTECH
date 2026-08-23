import React from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import { useOrders, getOrderStatus, canDownloadInvoice } from "./context/OrdersContext";
import { downloadInvoice } from "./lib/invoice";

import { nav, footer } from "./data/siteData";
import { ErrorState } from "./components/ui/Stateviews";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  if (status.isCancelled) {
    return (
      <span className="rns-tag" style={{ background: "#fdecec", color: "#c0392b", border: "1px solid transparent" }}>
        Cancelled
      </span>
    );
  }
  const isShipped = status.isShipped;
  return (
    <span
      className={`rns-tag ${isShipped ? "rns-tag--live" : ""}`}
      style={!isShipped ? { background: "var(--rns-primary-tint)", color: "var(--rns-primary-dark)", border: "1px solid transparent" } : undefined}
    >
      {status.currentStage.label}
    </span>
  );
}

/**
 * OrdersPage — "My Orders", reading straight from OrdersContext
 * (localStorage-backed). Each past order is summarized with its
 * items, live-computed delivery status, and quick actions to track,
 * view full details, or download the invoice — no page reload needed
 * for the invoice since it's generated client-side.
 */
export default function OrdersPage() {
  const { orders, ordersError } = useOrders();

  return (
    <>
      <SEO title="Your orders" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">Account</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Your orders
          </h1>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        {ordersError ? (
          <ErrorState message={ordersError.message} action={{ label: "Retry", onClick: () => window.location.reload() }} />
        ) : orders.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--rns-line)",
              borderRadius: 12,
              padding: "64px 24px",
              textAlign: "center",
            }}
          >
            <Icon name="package" size={32} style={{ color: "var(--rns-ink-faint)" }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 16 }}>
              No orders yet
            </div>
            <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>
              Orders you place will show up here, with tracking and invoices.
            </p>
            <Link to="/products" className="rns-btn rns-btn--primary" style={{ marginTop: 20 }}>
              Browse products
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {orders.map((order) => {
              const status = getOrderStatus(order);
              const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);

              return (
                <div key={order.id} className="rns-card" style={{ overflow: "hidden" }}>
                  {/* Header strip */}
                  <div
                    className="rns-orders-header"
                    style={{
                      background: "var(--rns-bg-alt)",
                      borderBottom: "1px solid var(--rns-line)",
                      padding: "14px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--rns-ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          Order placed
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{formatDate(order.date)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--rns-ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          Total
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{formatINR(order.total)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--rns-ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          Ship to
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>
                          {order.shippingAddress?.name || "—"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--rns-ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          Order #
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, fontFamily: "var(--rns-font-mono)" }}>
                          {order.id}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  {/* Items preview */}
                  <div style={{ padding: 20 }}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {order.items.map((item) => (
                        <Link
                          key={item.id}
                          to={`/products/${item.id}`}
                          title={item.name}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: "var(--rns-r-sm)",
                            overflow: "hidden",
                            background: "var(--rns-bg-alt)",
                            border: "1px solid var(--rns-line)",
                            flexShrink: 0,
                          }}
                        >
                          {item.image ? (
                            <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : null}
                        </Link>
                      ))}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--rns-ink-faint)", marginTop: 10 }}>
                      {itemCount} item{itemCount === 1 ? "" : "s"} · {order.paymentMethod}
                    </div>

                    {/* Review prompts only make sense once the order has
                        actually shipped — matches OrderDetailPage's item
                        list, which shows the same links. */}
                    {status.isShipped && (
                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        {order.items.map((item) => (
                          <Link
                            key={`review-${item.id}`}
                            to={`/products/${item.id}#reviews`}
                            className="rns-btn rns-btn--ghost"
                            style={{ fontSize: 12.5, padding: "6px 12px" }}
                          >
                            <Icon name="star" size={13} />
                            Review {item.name}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                      {/* No "Pay now" branch — GET /orders hard-filters
                          on paymentVerifiedAt, so every order listed here
                          is already paid; see storefront-backend's
                          listMyOrders. */}
                      <Link to={`/orders/${order.id}`} className="rns-btn rns-btn--ghost">
                        <Icon name="package" size={15} />
                        Track package
                      </Link>
                      <Link to={`/orders/${order.id}`} className="rns-btn rns-btn--ghost">
                        View order details
                      </Link>
                      {canDownloadInvoice(order) ? (
                        <button onClick={() => downloadInvoice(order)} className="rns-btn rns-btn--ghost">
                          <Icon name="download" size={15} />
                          Download invoice
                        </button>
                      ) : (
                        <span
                          title="Available once your order has shipped"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12.5,
                            color: "var(--rns-ink-faint)",
                            padding: "8px 4px",
                          }}
                        >
                          <Icon name="download" size={15} />
                          Invoice available after shipping
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        @media (max-width: 620px) {
          .rns-orders-header { flex-direction: column; align-items: flex-start !important; }
        }
      `}</style>
    </>
  );
}
