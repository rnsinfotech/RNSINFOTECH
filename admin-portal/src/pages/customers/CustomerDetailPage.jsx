import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import { getCustomer } from "../../services/customersService";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import PageLoader from "../../components/PageLoader";

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}
function formatWhen(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CustomerDetailPage() {
  const { email } = useParams();
  const decodedEmail = decodeURIComponent(email);

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCustomer(decodedEmail).then((c) => {
      if (!alive) return;
      setCustomer(c);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [decodedEmail]);

  if (loading) {
    return <PageLoader />;
  }

  if (!customer) {
    return (
      <div className="admin-card admin-empty">
        <h3>Customer not found</h3>
        <p>Check the customer and try again.</p>
        <Link to="/customers" className="admin-btn admin-btn--primary" style={{ marginTop: 14 }}>
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/customers" className="admin-back-link">
        <Icon name="chevronLeft" size={13} />
        Back to customers
      </Link>

      <div className="admin-page-header">
        <div>
          <h1>{customer.name}</h1>
          <p style={{ marginBottom: 8 }}>
            Customer since {formatWhen(customer.firstOrderDate)} · {customer.orderCount} order{customer.orderCount === 1 ? "" : "s"}
          </p>
          {customer.orderCount > 1 && <Badge tone="info">Repeat customer</Badge>}
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-card" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, padding: "16px 16px 0" }}>Order history</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Placed</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>
                          {o.id}
                        </Link>
                      </td>
                      <td>
                        {o.items.reduce((n, it) => n + it.qty, 0)} item{o.items.reduce((n, it) => n + it.qty, 0) === 1 ? "" : "s"}
                      </td>
                      <td>{formatINR(o.total)}</td>
                      <td style={{ color: "var(--admin-ink-faint)", fontSize: 12.5 }}>{formatWhen(o.date)}</td>
                      <td>
                        <Badge tone={STATUS_TONE[o.status]}>{statusLabel(o.status)}</Badge>
                      </td>
                      <td>
                        <div className="admin-table__actions">
                          <Link to={`/orders/${o.id}`} className="admin-btn admin-btn--ghost admin-btn--sm">
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
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Contact</h3>
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--admin-ink-soft)" }}>
                <Icon name="message" size={13} />
                {customer.email}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--admin-ink-soft)", marginTop: 6 }}>
                <Icon name="mapPin" size={13} />
                {[customer.city, customer.state].filter(Boolean).join(", ")}
              </div>
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--admin-ink-faint)" }}>
              Phone: {customer.phone}
            </p>
          </div>

          <div className="admin-card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Lifetime value</h3>
            <div className="admin-kv-list">
              <div>
                <span>Orders</span>
                <span>{customer.orderCount}</span>
              </div>
              <div>
                <span>Total spent</span>
                <span>{formatINR(customer.totalSpent)}</span>
              </div>
              <div>
                <span>First order</span>
                <span>{formatWhen(customer.firstOrderDate)}</span>
              </div>
              <div>
                <span>Last order</span>
                <span>{formatWhen(customer.lastOrderDate)}</span>
              </div>
            </div>
            <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--admin-ink-faint)" }}>
              Total spent excludes cancelled orders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
