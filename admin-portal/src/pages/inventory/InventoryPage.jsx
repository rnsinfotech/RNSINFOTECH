import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import EmptyState from "../../components/EmptyState";
import PageLoader from "../../components/PageLoader";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import StockAdjustModal from "./StockAdjustModal";
import { getInventory, getInventoryStats, getAdjustments } from "../../services/inventoryService";
import { STATUS_TONE, statusLabel } from "../../utils/format";

const STOCK_TABS = [
  { value: "", label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "low-stock", label: "Low stock" },
  { value: "out-of-stock", label: "Out of stock" },
];

function formatWhen(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InventoryPage() {
  const { toast, showToast, clearToast } = useToast();

  const [view, setView] = useState("levels"); // "levels" | "history"
  const [stats, setStats] = useState(null);

  const [q, setQ] = useState("");
  const [stock, setStock] = useState("");
  const [products, setProducts] = useState(null);
  const [adjusting, setAdjusting] = useState(null);

  const [historyQ, setHistoryQ] = useState("");
  const [history, setHistory] = useState(null);

  async function loadStats() {
    setStats(await getInventoryStats());
  }
  async function loadLevels() {
    setProducts(await getInventory({ q, stock }));
  }
  async function loadHistory() {
    setHistory(await getAdjustments({ q: historyQ }));
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (view === "levels") loadLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, q, stock]);

  useEffect(() => {
    if (view === "history") loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, historyQ]);

  function handleAdjusted(entry) {
    setAdjusting(null);
    showToast(
      `${entry.delta > 0 ? "+" : ""}${entry.delta} — "${entry.productName}" is now at ${entry.newQty} units`
    );
    loadStats();
    loadLevels();
  }

  return (
    <PermissionBoundary permission="inventory.write"><div>
      <div className="admin-page-header">
        <div>
          <h1>Inventory</h1>
          <p>Track stock levels across the catalogue and log every adjustment.</p>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Total products" value={stats.total} icon="package" />
          <StatCard label="In stock" value={stats.inStock} icon="check" />
          <StatCard label="Low stock" value={stats.lowStock} icon="alert" />
          <StatCard label="Out of stock" value={stats.outOfStock} icon="warehouse" />
        </div>
      )}

      <div className="admin-segmented" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`admin-segmented__btn${view === "levels" ? " is-active" : ""}`}
          onClick={() => setView("levels")}
        >
          <Icon name="warehouse" size={14} />
          Stock levels
        </button>
        <button
          type="button"
          className={`admin-segmented__btn${view === "history" ? " is-active" : ""}`}
          onClick={() => setView("history")}
        >
          <Icon name="clock" size={14} />
          Adjustment history
        </button>
      </div>

      {view === "levels" ? (
        <div className="admin-card" style={{ padding: 0 }}>
          <div style={{ padding: "16px 16px 0" }}>
            <div className="admin-toolbar">
              <div className="admin-toolbar__search">
                <Icon name="search" size={15} />
                <input
                  className="admin-input"
                  placeholder="Search name, SKU, or brand…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="admin-segmented admin-segmented--sm">
                {STOCK_TABS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`admin-segmented__btn${stock === t.value ? " is-active" : ""}`}
                    onClick={() => setStock(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {products === null ? (
            <PageLoader />
          ) : products.length === 0 ? (
            <EmptyState icon="warehouse" title="No products found" description="Try adjusting your search or filter." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="admin-table__title-cell">
                          <img className="admin-table__thumb" src={p.image} alt="" />
                          <div>
                            <Link to={`/products/${p.id}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>
                              {p.name}
                            </Link>
                            <div className="admin-table__title-sub">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td>{p.category}</td>
                      <td>{p.brand}</td>
                      <td>
                        <Badge tone={STATUS_TONE[p.stock]}>{statusLabel(p.stock)}</Badge>
                        <span style={{ marginLeft: 8, fontSize: 11.5, color: "var(--admin-ink-faint)" }}>
                          {p.stockQty} units
                        </span>
                      </td>
                      <td>
                        <Badge tone={p.status === "active" ? "success" : "neutral"}>{statusLabel(p.status)}</Badge>
                      </td>
                      <td>
                        <div className="admin-table__actions">
                          <button
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            type="button"
                            onClick={() => setAdjusting(p)}
                          >
                            <Icon name="sliders" size={13} />
                            Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="admin-card" style={{ padding: 0 }}>
          <div style={{ padding: "16px 16px 0" }}>
            <div className="admin-toolbar">
              <div className="admin-toolbar__search">
                <Icon name="search" size={15} />
                <input
                  className="admin-input"
                  placeholder="Search by product or SKU…"
                  value={historyQ}
                  onChange={(e) => setHistoryQ(e.target.value)}
                />
              </div>
            </div>
          </div>

          {history === null ? (
            <PageLoader />
          ) : history.length === 0 ? (
            <EmptyState icon="clock" title="No adjustments yet" description="Stock changes you log from Stock levels will show up here." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Change</th>
                    <th>Action</th>
                    <th>Reason</th>
                    <th>Before → After</th>
                    <th>Responsible</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/products/${a.productId}`} className="admin-table__title-main" style={{ textDecoration: "none" }}>
                          {a.productName}
                        </Link>
                        <div className="admin-table__title-sub">{a.sku}</div>
                      </td>
                      <td>
                        <Badge tone={a.delta >= 0 ? "success" : "danger"}>
                          {a.delta > 0 ? "+" : ""}
                          {a.delta} units
                        </Badge>
                      </td>
                      <td>{a.action || "adjustment"}</td>
                      <td>{a.reason}</td>
                      <td style={{ color: "var(--admin-ink-soft)" }}>
                        {a.previousQty} → {a.newQty}
                      </td>
                      <td>{a.actorName || a.actorEmail || (a.actorType === "system" ? "System" : "Unknown")}</td>
                      <td style={{ color: "var(--admin-ink-faint)", fontSize: 12.5 }}>{formatWhen(a.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adjusting && (
        <StockAdjustModal product={adjusting} onClose={() => setAdjusting(null)} onSaved={handleAdjusted} />
      )}
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  </PermissionBoundary>
  );}
