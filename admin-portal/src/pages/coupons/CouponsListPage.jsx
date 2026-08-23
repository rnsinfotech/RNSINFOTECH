import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import StatCard from "../../components/StatCard";
import useToast from "../../hooks/useToast";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import CouponFormModal from "./CouponFormModal";
import PageLoader from "../../components/PageLoader";
import {
  getCoupons,
  getCouponStats,
  updateCoupon,
  deleteCoupon,
  effectiveStatus,
} from "../../services/couponsService";

function formatDate(iso) {
  if (!iso) return "No expiry";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CouponsListPage() {
  const { toast, showToast, clearToast } = useToast();
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setError("");
    try {
      const [items, s] = await Promise.all([getCoupons({ search }), getCouponStats()]);
      setCoupons(items);
      setStats(s);
    } catch (err) {
      setCoupons(null);
      setError(err.message || "Unable to load coupons.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => {
    if (!coupons) return [];
    const q = search.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter((c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [coupons, search]);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(coupon) {
    setEditing(coupon);
    setShowForm(true);
  }

  function handleSaved(_saved, message) {
    setShowForm(false);
    showToast(message);
    load();
  }

  async function toggleStatus(coupon) {
    await updateCoupon(coupon.id, { status: coupon.status === "active" ? "inactive" : "active" });
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteCoupon(pendingDelete.id);
    setPendingDelete(null);
    showToast(`Deleted "${pendingDelete.code}"`);
    load();
  }

  return (
    <PermissionBoundary permission="coupons.write"><div>
      <div className="admin-page-header">
        <div>
          <h1>Coupons</h1>
          <p>Create and manage discount codes. Admin-side only until checkout wires up coupon redemption.</p>
        </div>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd}>
          <Icon name="plus" size={15} />
          Add coupon
        </button>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Total coupons" value={stats.total} icon="percent" />
          <StatCard label="Active" value={stats.active} icon="check" />
          <StatCard label="Expired" value={stats.expired} icon="clock" />
          <StatCard label="Total redemptions" value={stats.totalRedemptions} icon="tag" />
        </div>
      )}

      <div className="admin-toolbar">
        <div className="admin-toolbar__search">
          <Icon name="search" size={15} />
          <input
            className="admin-input"
            placeholder="Search code or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="admin-card"><div style={{ color: "var(--admin-danger)", marginBottom: 12 }}>{error}</div><button className="admin-btn admin-btn--ghost" type="button" onClick={load}>Try again</button></div>
      ) : coupons === null ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState icon="percent" title="No coupons yet" description="Add your first discount code." />
      ) : (
        <div className="admin-card" style={{ padding: 0 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min. order</th>
                  <th>Usage</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const status = effectiveStatus(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="admin-table__title-cell">
                          <div className="admin-table__title-main" style={{ fontFamily: "monospace", letterSpacing: 0.4 }}>
                            {c.code}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--admin-ink-soft)" }}>{c.description}</div>
                      </td>
                      <td>{c.type === "percent" ? `${c.value}%` : `₹${c.value.toLocaleString("en-IN")}`}</td>
                      <td>{c.minOrderValue > 0 ? `₹${c.minOrderValue.toLocaleString("en-IN")}` : "—"}</td>
                      <td>
                        {c.usageCount}
                        {c.usageLimit > 0 ? ` / ${c.usageLimit}` : ""}
                        {c.reservedCount > 0 ? ` (${c.reservedCount} reserved)` : ""}
                      </td>
                      <td>{formatDate(c.expiresAt)}</td>
                      <td>
                        {status === "active" ? (
                          <button
                            className="admin-toggle is-on"
                            type="button"
                            onClick={() => toggleStatus(c)}
                            aria-pressed
                          >
                            <span className="admin-toggle__track" />
                            <span style={{ fontSize: 12, color: "var(--admin-ink-soft)", fontWeight: 600 }}>Active</span>
                          </button>
                        ) : status === "inactive" ? (
                          <button className="admin-toggle" type="button" onClick={() => toggleStatus(c)} aria-pressed={false}>
                            <span className="admin-toggle__track" />
                            <span style={{ fontSize: 12, color: "var(--admin-ink-soft)", fontWeight: 600 }}>Inactive</span>
                          </button>
                        ) : (
                          <Badge tone={STATUS_TONE[status]}>{statusLabel(status)}</Badge>
                        )}
                      </td>
                      <td>
                        <div className="admin-table__actions">
                          <button className="admin-icon-btn" type="button" aria-label="Edit" onClick={() => openEdit(c)}>
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="admin-icon-btn admin-icon-btn--danger"
                            type="button"
                            aria-label="Delete"
                            onClick={() => setPendingDelete(c)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <CouponFormModal coupon={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this coupon?"
        description={pendingDelete ? `"${pendingDelete.code}" will be permanently removed.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  </PermissionBoundary>
  );}
