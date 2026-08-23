import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import EmptyState from "../../components/EmptyState";
import { getOrders, getOrderStats } from "../../services/ordersService";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import PageLoader from "../../components/PageLoader";

// Simplified 4-state order lifecycle — see PROGRESS_ORDER_SIMPLIFICATION.md.
const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "cancelled", label: "Cancelled" },
];

function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
function formatWhen(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrdersListPage() {
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    getOrderStats().then(setStats);
  }, []);

  useEffect(() => {
    let alive = true;
    getOrders({ q, status }).then((items) => alive && setOrders(items));
    return () => {
      alive = false;
    };
  }, [q, status]);

  return (
    <PermissionBoundary permission="orders.write"><div>
      <div className="admin-page-header">
        <div>
          <h1>Orders</h1>
          <p>Every paid order placed on the storefront, with status and payment at a glance.</p>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Total orders" value={stats.total} icon="truck" />
          <StatCard label="Pending" value={stats.pending} icon="inbox" />
          <StatCard label="Confirmed" value={stats.confirmed} icon="refresh" />
          <StatCard label="Shipped" value={stats.shipped} icon="check" />
        </div>
      )}

      <div className="admin-card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 16px 0" }}>
          <div className="admin-toolbar">
            <div className="admin-toolbar__search">
              <Icon name="search" size={15} />
              <input
                className="admin-input"
                placeholder="Search order ID, customer, or phone…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-segmented admin-segmented--sm" style={{ marginTop: 12, marginBottom: 14, flexWrap: "wrap" }}>
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

        {orders === null ? (
          <PageLoader />
        ) : orders.length === 0 ? (
          <EmptyState icon="truck" title="No orders found" description="Try adjusting your search or filter." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>
                        {o.id}
                      </Link>
                    </td>
                    <td>
                      <div className="admin-table__title-sub" style={{ fontWeight: 600, color: "var(--admin-ink)" }}>
                        {o.shippingAddress.name}
                      </div>
                      <div className="admin-table__title-sub">{o.shippingAddress.phone}</div>
                    </td>
                    <td>
                      {o.items.reduce((n, it) => n + it.qty, 0)} item{o.items.reduce((n, it) => n + it.qty, 0) === 1 ? "" : "s"}
                    </td>
                    <td>{formatINR(o.total)}</td>
                    <td>{o.paymentStatus === "refunded" ? "Refunded" : "Paid online"}</td>
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
        )}
      </div>
    </div>
  </PermissionBoundary>
  );}
