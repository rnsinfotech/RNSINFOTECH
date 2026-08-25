import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import PermissionBoundary from "../../components/PermissionBoundary";
import { getPayment, refundPayment, reconcilePayment } from "../../services/paymentsService";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import PageLoader from "../../components/PageLoader";

const METHOD_LABEL = { upi: "UPI", card: "Card", netbanking: "Netbanking", cod: "Cash on delivery" };
const methodLabel = (method) => METHOD_LABEL[method] || "Unknown";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PaymentDetailPage() {
  const { id } = useParams();
  const { toast, showToast, clearToast } = useToast();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getPayment(id).then((p) => {
      if (!alive) return;
      setPayment(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  async function handleRefund() {
    const updated = await refundPayment(id);
    setPayment(updated);
    setConfirmOpen(false);
    showToast("Refund request sent to Razorpay");
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!payment) {
    return (
      <div className="admin-card admin-empty">
        <h3>Payment not found</h3>
        <p>Check the payment ID and try again.</p>
        <Link to="/payments" className="admin-btn admin-btn--primary" style={{ marginTop: 14 }}>
          Back to payments
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/payments" className="admin-back-link">
        <Icon name="chevronLeft" size={13} />
        Back to payments
      </Link>

      <div className="admin-page-header">
        <div>
          <h1>{payment.id}</h1>
          <p style={{ marginBottom: 8 }}>
            {formatDateTime(payment.at)} · {methodLabel(payment.method)}
          </p>
          <Badge tone={STATUS_TONE[payment.status]}>{statusLabel(payment.status)}</Badge>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
        {["created", "paid"].includes(payment.status) && (
          <button className="admin-btn admin-btn--ghost" type="button" onClick={async () => {
            try { setPayment(await reconcilePayment(id)); showToast("Payment reconciled with Razorpay"); }
            catch (err) { showToast(err.message || "Reconciliation failed.", "danger"); }
          }}>
            Reconcile
          </button>
        )}
        {/* Manual refund only ever applies to a cancelled order — see
            admin-backend/src/controllers/payment.controller.js. "returned"
            was removed with the old 10-state order model and can never
            match here anymore. */}
        {payment.status === "paid" && payment.orderStatus === "cancelled" && payment.refundStatus !== "pending" && payment.refundStatus !== "processed" && (
          <div style={{ display: "flex", gap: 10 }}>
            <PermissionBoundary permission="payments.refund"><button className="admin-btn admin-btn--ghost" type="button" onClick={() => setConfirmOpen(true)}>
              <Icon name="refresh" size={14} />
              Issue Razorpay refund
            </button></PermissionBoundary>
          </div>
        )}
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="admin-card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Payment details</h3>
          <div className="admin-kv-list">
            <div>
              <span>Amount</span>
              <span>{formatINR(payment.amount)}</span>
            </div>
            <div>
              <span>Method</span>
              <span>{methodLabel(payment.method)}</span>
            </div>
            <div>
              <span>Status</span>
              <span>{statusLabel(payment.status)}</span>
            </div>
            <div>
              <span>Order</span>
              <span>
                <Link to={`/orders/${payment.orderId}`}>{payment.orderId}</Link>
              </span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Customer</h3>
          <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600 }}>{payment.customerName}</div>
            <div style={{ color: "var(--admin-ink-soft)" }}>{payment.customerEmail}</div>
          </div>
          <Link to={`/orders/${payment.orderId}`} className="admin-btn admin-btn--ghost admin-btn--sm" style={{ marginTop: 14 }}>
            <Icon name="truck" size={13} />
            View order
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Mark this payment as refunded?"
        description={`${formatINR(payment.amount)} for order ${payment.orderId} will be marked refunded.`}
        confirmLabel="Mark refunded"
        onConfirm={handleRefund}
        onCancel={() => setConfirmOpen(false)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
