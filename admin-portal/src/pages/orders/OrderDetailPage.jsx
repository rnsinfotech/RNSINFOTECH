import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import ConfirmDialog from "../../components/ConfirmDialog";
import useToast from "../../hooks/useToast";
import OrderShipModal from "./OrderShipModal";
import PageLoader from "../../components/PageLoader";

import { getOrder, confirmOrder, cancelOrder, uploadOrderBill } from "../../services/ordersService";
import { STATUS_TONE, statusLabel } from "../../utils/format";

function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// Simplified 4-state order lifecycle — see PROGRESS_ORDER_SIMPLIFICATION.md.
// pending -> confirmed -> shipped is the only "happy path"; cancelled is a
// separate terminal branch off pending/confirmed, not a stage on this line.
const TIMELINE_STAGES = ["pending", "confirmed", "shipped"];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { toast, showToast, clearToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shipping, setShipping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [uploadingBill, setUploadingBill] = useState(false);

  useEffect(() => {
    let alive = true;
    getOrder(id).then((o) => {
      if (!alive) return;
      setOrder(o);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const updated = await confirmOrder(order.id);
      setOrder(updated);
      showToast("Order confirmed");
    } catch (err) {
      showToast(err.message || "Something went wrong.", "danger");
    } finally {
      setConfirming(false);
    }
  }

  function handleShipped(updated) {
    setOrder(updated);
    setShipping(false);
    showToast(`Marked as shipped — customer now sees ${updated.courierName} tracking ${updated.trackingId}`);
  }

  async function handleBillFileChange(e) {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Bill file must be under 10MB.", "danger");
      return;
    }
    setUploadingBill(true);
    try {
      const updated = await uploadOrderBill(order.id, file);
      setOrder(updated);
      showToast("Bill uploaded — the customer can now see it on their order page.");
    } catch (err) {
      showToast(err.message || "Something went wrong.", "danger");
    } finally {
      setUploadingBill(false);
    }
  }

  async function handleCancelConfirmed() {
    try {
      const updated = await cancelOrder(order.id);
      setOrder(updated);
      showToast("Order cancelled");
    } catch (err) {
      showToast(err.message || "Something went wrong.", "danger");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!order) {
    return (
      <div className="admin-card admin-empty">
        <h3>Order not found</h3>
        <p>Check the order ID and try again.</p>
        <Link to="/orders" className="admin-btn admin-btn--primary" style={{ marginTop: 14 }}>
          Back to orders
        </Link>
      </div>
    );
  }

  const currentIndex = TIMELINE_STAGES.indexOf(order.status);
  const canCancel = ["pending", "confirmed"].includes(order.status);

  return (
    <PermissionBoundary permission="orders.write"><div>
      <Link to="/orders" className="admin-back-link">
        <Icon name="chevronLeft" size={13} />
        Back to orders
      </Link>

      <div className="admin-page-header">
        <div>
          <h1>{order.id}</h1>
          <p style={{ marginBottom: 8 }}>Placed {formatDateTime(order.date)} · Paid online</p>
          <Badge tone={STATUS_TONE[order.status]}>{statusLabel(order.status)}</Badge>
        </div>
        {/* Admin's role is exactly three actions on an order, in this
            order: confirm (pending -> confirmed), ship (confirmed ->
            shipped, with courier + tracking), or cancel
            (pending/confirmed -> cancelled). Nothing else — no pack,
            out-for-delivery, deliver, or return actions anymore. */}
        <div style={{ display: "flex", gap: 10 }}>
          {order.status === "pending" && (
            <button className="admin-btn admin-btn--primary" type="button" onClick={handleConfirm} disabled={confirming}>
              <Icon name="check" size={14} />
              {confirming ? "Confirming…" : "Confirm order"}
            </button>
          )}
          {order.status === "confirmed" && (
            <button className="admin-btn admin-btn--primary" type="button" onClick={() => setShipping(true)}>
              <Icon name="truck" size={14} /> Mark as shipped
            </button>
          )}
          {canCancel && (
            <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setCancelling(true)}>
              Cancel order
            </button>
          )}
        </div>
      </div>

      {order.status === "cancelled" ? (
        <div className="admin-card" style={{ marginBottom: 20, borderColor: "var(--admin-danger)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--admin-danger)", fontWeight: 600, fontSize: 13.5 }}>
            <Icon name="alert" size={16} />
            Cancelled{order.cancelReason ? ` — ${order.cancelReason}` : ""}
          </div>
        </div>
      ) : (
        <div className="admin-card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>Fulfillment timeline</h3>
          <div className="admin-timeline">
            {TIMELINE_STAGES.map((stage, i) => (
              <div key={stage} className={`admin-timeline__step${i <= currentIndex ? " is-complete" : ""}`}>
                <div className="admin-timeline__dot" />
                <div className="admin-timeline__label">{statusLabel(stage)}</div>
              </div>
            ))}
          </div>
          {order.status === "shipped" ? (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: "var(--admin-ink-soft)",
                background: "var(--admin-success-tint)",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <Icon name="check" size={15} style={{ color: "var(--admin-success)", flexShrink: 0 }} />
              <span>
                Shipped via <strong>{order.courierName}</strong> · Tracking ID <strong>{order.trackingId}</strong> — RNS INFOTECH's
                part in this order is complete; the customer sees these same details on the storefront.
              </span>
            </div>
          ) : (
            <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--admin-ink-faint)" }}>
              Delivery estimate shown to the customer: {order.deliveryEstimate}
            </p>
          )}
          {order.status === "shipped" && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                flexWrap: "wrap",
              }}
            >
              {order.billUrl ? (
                <>
                  <Icon name="check" size={15} style={{ color: "var(--admin-success)", flexShrink: 0 }} />
                  <a href={order.billUrl} target="_blank" rel="noreferrer" style={{ color: "var(--admin-primary)" }}>
                    View uploaded bill
                  </a>
                  <span style={{ color: "var(--admin-ink-faint)", fontSize: 12 }}>
                    {order.billUploadedAt ? `· uploaded ${formatDateTime(order.billUploadedAt)}` : ""}
                  </span>
                </>
              ) : (
                <span style={{ color: "var(--admin-ink-faint)" }}>No bill uploaded yet — the customer won't see one until you add it.</span>
              )}
              <label className="admin-btn admin-btn--ghost" style={{ cursor: uploadingBill ? "default" : "pointer", opacity: uploadingBill ? 0.6 : 1 }}>
                <Icon name="upload" size={13} />
                {uploadingBill ? "Uploading…" : order.billUrl ? "Replace bill" : "Upload bill"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleBillFileChange}
                  disabled={uploadingBill}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <div className="admin-grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-card" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, padding: "16px 16px 0" }}>Items</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th style={{ textAlign: "right" }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it, i) => (
                    <tr key={`${it.id}-${i}`}>
                      <td>
                        <div className="admin-table__title-cell">
                          {it.image && <img className="admin-table__thumb" src={it.image} alt="" />}
                          <div>
                            {it.id ? (
                              <Link to={`/products/${it.id}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>
                                {it.name}
                              </Link>
                            ) : (
                              <span className="admin-table__title-main">{it.name}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{it.sku}</td>
                      <td>{it.qty}</td>
                      <td style={{ textAlign: "right" }}>{formatINR(it.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Order summary</h3>
            <div className="admin-kv-list">
              <div>
                <span>Subtotal</span>
                <span>{formatINR(order.subtotal)}</span>
              </div>
              <div>
                <span>Shipping</span>
                <span>{order.shippingFee ? formatINR(order.shippingFee) : "Free"}</span>
              </div>
              {order.discount > 0 && (
                <div>
                  <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                  <span>-{formatINR(order.discount)}</span>
                </div>
              )}
              <div>
                <span>Total</span>
                <span>{formatINR(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Customer &amp; shipping</h3>
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600 }}>{order.shippingAddress.name}</div>
              <div style={{ color: "var(--admin-ink-soft)" }}>{order.shippingAddress.phone}</div>
              <div style={{ color: "var(--admin-ink-soft)" }}>{order.customerEmail}</div>
              <div style={{ marginTop: 10, color: "var(--admin-ink-soft)" }}>
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
                <br />
                {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode].filter(Boolean).join(", ")}
              </div>
            </div>
          </div>

          <div className="admin-card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Payment</h3>
            <div className="admin-kv-list">
              <div>
                <span>Method</span>
                <span>Online (Cashfree)</span>
              </div>
              <div>
                <span>Status</span>
                <span>{order.paymentStatus === "refunded" ? "Refunded" : "Paid"}</span>
              </div>
            </div>
            <Link to="/payments" className="admin-btn admin-btn--ghost admin-btn--sm" style={{ marginTop: 12 }}>
              <Icon name="creditCard" size={13} />
              View payment
            </Link>
          </div>
        </div>
      </div>

      {shipping && <OrderShipModal order={order} onClose={() => setShipping(false)} onSaved={handleShipped} />}
      <ConfirmDialog
        open={cancelling}
        title="Cancel this order?"
        description={`${order.id} will be marked cancelled, refunded, and removed from the fulfillment queue.`}
        confirmLabel="Cancel order"
        onConfirm={handleCancelConfirmed}
        onCancel={() => setCancelling(false)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  </PermissionBoundary>
  );}
