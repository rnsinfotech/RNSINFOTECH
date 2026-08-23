import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import StatCard from "../components/StatCard";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import { getDashboardSummary } from "../services/dashboardService";
import { STATUS_TONE, statusLabel } from "../utils/format";
import PageLoader from "../components/PageLoader";

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    getDashboardSummary().then((res) => alive && setData(res));
    return () => {
      alive = false;
    };
  }, []);

  if (!data) {
    return <PageLoader />;
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>A quick look at how the store is doing today.</p>
        </div>
      </div>

      <div className="admin-stat-grid">
        {data.stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1.6fr 1fr", marginBottom: 16 }}>
        <div className="admin-card">
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Sales this week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-line)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--admin-ink-faint)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--admin-ink-faint)" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Sales"]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--admin-line)", fontSize: 12.5 }}
              />
              <Line type="monotone" dataKey="sales" stroke="var(--rns-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-card">
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Low-stock products</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.lowStock.map((p) => (
              <div key={p.sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: "var(--admin-ink-faint)", fontSize: 11.5 }}>{p.sku}</div>
                </div>
                <Badge tone="warning">{p.stock} left</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="admin-card" style={{ padding: 0 }}>
          <h3 style={{ fontSize: 14, padding: "18px 18px 4px" }}>Recent orders</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--admin-ink-faint)", fontSize: 11.5 }}>
                <th style={{ padding: "10px 18px", fontWeight: 600 }}>Order</th>
                <th style={{ padding: "10px 18px", fontWeight: 600 }}>Customer</th>
                <th style={{ padding: "10px 18px", fontWeight: 600 }}>Total</th>
                <th style={{ padding: "10px 18px", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--admin-line)" }}>
                  <td style={{ padding: "12px 18px", fontWeight: 600 }}>{o.id}</td>
                  <td style={{ padding: "12px 18px" }}>{o.customer}</td>
                  <td style={{ padding: "12px 18px" }}>{o.total}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <Badge tone={STATUS_TONE[o.status]}>{statusLabel(o.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-card">
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Recent activity</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.recentActivity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                <Icon name="clock" size={14} style={{ color: "var(--admin-ink-faint)", marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div>{a.text}</div>
                  <div style={{ color: "var(--admin-ink-faint)", fontSize: 11.5 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
