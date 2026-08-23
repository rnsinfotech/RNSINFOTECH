import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import EmptyState from "../../components/EmptyState";
import { getPayments, getPaymentStats } from "../../services/paymentsService";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import PageLoader from "../../components/PageLoader";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "created", label: "Pending" },
  { value: "paid", label: "Successful" },
  { value: "failed", label: "Failed" },
  { value: "expired", label: "Expired" },
  { value: "refunded", label: "Refunded" },
];

const METHOD_LABEL = { upi: "UPI", card: "Card", netbanking: "Netbanking", cod: "Cash on delivery" };

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}
function formatWhen(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function PaymentsListPage() {
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payments, setPayments] = useState(null);

  useEffect(() => {
    getPaymentStats().then(setStats);
  }, []);

  useEffect(() => {
    let alive = true;
    getPayments({ q, status }).then((items) => alive && setPayments(items));
    return () => {
      alive = false;
    };
  }, [q, status]);

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Payments</h1>
          <p>Every payment tied to an order — online or cash on delivery.</p>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Total payments" value={stats.total} icon="creditCard" />
          <StatCard label="Successful" value={stats.successful} icon="check" />
          <StatCard label="Pending" value={stats.pending} icon="inbox" />
          <StatCard label="Failed / refunded" value={stats.failed + stats.refunded} icon="alert" />
        </div>
      )}

      <div className="admin-card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 16px 0" }}>
          <div className="admin-toolbar">
            <div className="admin-toolbar__search">
              <Icon name="search" size={15} />
              <input
                className="admin-input"
                placeholder="Search payment ID, order ID, or customer…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="admin-segmented admin-segmented--sm">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`admin-segmented__btn${status === t.value ? " is-active" : ""}`}
                  onClick={() => setStatus(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {payments === null ? (
          <PageLoader />
        ) : payments.length === 0 ? (
          <EmptyState icon="creditCard" title="No payments found" description="Try adjusting your search or filter." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/payments/${p.id}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>
                        {p.id}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/orders/${p.orderId}`} className="admin-table__title-sub" style={{ textDecoration: "none" }}>
                        {p.orderId}
                      </Link>
                    </td>
                    <td>{p.customerName}</td>
                    <td>{formatINR(p.amount)}</td>
                    <td>{METHOD_LABEL[p.method]}</td>
                    <td style={{ color: "var(--admin-ink-faint)", fontSize: 12.5 }}>{formatWhen(p.at)}</td>
                    <td>
                      <Badge tone={STATUS_TONE[p.status]}>{statusLabel(p.status)}</Badge>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <Link to={`/payments/${p.id}`} className="admin-btn admin-btn--ghost admin-btn--sm">
                          <Icon name="arrowRight" size={13} />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
