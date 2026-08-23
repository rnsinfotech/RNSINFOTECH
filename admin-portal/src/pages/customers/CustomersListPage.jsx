import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import StatCard from "../../components/StatCard";
import EmptyState from "../../components/EmptyState";
import { getCustomers, getCustomerStats } from "../../services/customersService";
import PageLoader from "../../components/PageLoader";

const SORT_TABS = [
  { value: "recent", label: "Most recent" },
  { value: "orders", label: "Most orders" },
  { value: "spend", label: "Highest spend" },
];

function formatINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}
function formatWhen(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CustomersListPage() {
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [customers, setCustomers] = useState(null);

  useEffect(() => {
    getCustomerStats().then(setStats);
  }, []);

  useEffect(() => {
    let alive = true;
    getCustomers({ q, sort }).then((items) => alive && setCustomers(items));
    return () => {
      alive = false;
    };
  }, [q, sort]);

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Customers</h1>
          <p>Everyone who has placed an order, grouped by email.</p>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Total customers" value={stats.total} icon="user" />
          <StatCard label="Repeat customers" value={stats.repeat} icon="refresh" />
          <StatCard label="Total revenue" value={formatINR(stats.totalRevenue)} icon="creditCard" />
          <StatCard label="Avg. order value" value={formatINR(stats.avgOrderValue)} icon="tag" />
        </div>
      )}

      <div className="admin-card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 16px 0" }}>
          <div className="admin-toolbar">
            <div className="admin-toolbar__search">
              <Icon name="search" size={15} />
              <input
                className="admin-input"
                placeholder="Search name, email, or phone…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="admin-segmented admin-segmented--sm">
              {SORT_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`admin-segmented__btn${sort === t.value ? " is-active" : ""}`}
                  onClick={() => setSort(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {customers === null ? (
          <PageLoader />
        ) : customers.length === 0 ? (
          <EmptyState icon="user" title="No customers found" description="Try adjusting your search." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Orders</th>
                  <th>Total spent</th>
                  <th>Last order</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/customers/${encodeURIComponent(c.email)}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>
                        {c.name}
                      </Link>
                      <div className="admin-table__title-sub">{c.email}</div>
                    </td>
                    <td>{[c.city, c.state].filter(Boolean).join(", ")}</td>
                    <td>
                      {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
                    </td>
                    <td>{formatINR(c.totalSpent)}</td>
                    <td style={{ color: "var(--admin-ink-faint)", fontSize: 12.5 }}>{formatWhen(c.lastOrderDate)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <Link to={`/customers/${encodeURIComponent(c.email)}`} className="admin-btn admin-btn--ghost admin-btn--sm">
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
