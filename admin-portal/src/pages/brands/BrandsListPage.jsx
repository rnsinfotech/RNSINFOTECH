import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import BrandFormModal from "./BrandFormModal";
import { getBrands, updateBrand, deleteBrand } from "../../services/brandsService";
import PageLoader from "../../components/PageLoader";

export default function BrandsListPage() {
  const { toast, showToast, clearToast } = useToast();
  const [brands, setBrands] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setBrands(await getBrands());
    } catch (err) {
      setBrands(null);
      setError(err.message || "Unable to load brands.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(brand) {
    setEditing(brand);
    setShowForm(true);
  }

  function handleSaved(_saved, message) {
    setShowForm(false);
    showToast(message);
    load();
  }

  async function toggleStatus(brand) {
    try {
      await updateBrand(brand.id, { status: brand.status === "active" ? "inactive" : "active" });
      showToast(`${brand.name} is now ${brand.status === "active" ? "inactive" : "active"}`);
      load();
    } catch (err) {
      showToast(err.message || "Unable to update brand.", "danger");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.count > 0) {
      showToast(`Can't delete "${pendingDelete.name}" — it still has ${pendingDelete.count} product(s).`, "danger");
      setPendingDelete(null);
      return;
    }
    try {
      await deleteBrand(pendingDelete.id);
      setPendingDelete(null);
      showToast(`Deleted "${pendingDelete.name}"`);
      load();
    } catch (err) {
      setPendingDelete(null);
      showToast(err.message || "Unable to delete brand.", "danger");
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Brands</h1>
          <p>Manage the brands available across your catalogue.</p>
        </div>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd}>
          <Icon name="plus" size={15} />
          Add brand
        </button>
      </div>

      {error ? (
        <div className="admin-card">
          <div style={{ color: "var(--admin-danger)", marginBottom: 12 }}>{error}</div>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={load} disabled={loading}>Try again</button>
        </div>
      ) : brands === null ? (
        <PageLoader />
      ) : brands.length === 0 ? (
        <EmptyState icon="layers" title="No brands yet" description="Add your first brand to start tagging products." />
      ) : (
        <div className="admin-card" style={{ padding: 0 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="admin-table__title-cell">
                        <img
                          className="admin-table__thumb"
                          style={{ objectFit: "contain", padding: 6 }}
                          src={b.logo}
                          alt=""
                          onError={(e) => (e.target.style.visibility = "hidden")}
                        />
                        <div className="admin-table__title-main">{b.name}</div>
                      </div>
                    </td>
                    <td>
                      <Badge tone="neutral">{b.count} product{b.count === 1 ? "" : "s"}</Badge>
                    </td>
                    <td>
                      <button
                        className={`admin-toggle${b.status === "active" ? " is-on" : ""}`}
                        type="button"
                        onClick={() => toggleStatus(b)}
                        aria-pressed={b.status === "active"}
                      >
                        <span className="admin-toggle__track" />
                        <span style={{ fontSize: 12, color: "var(--admin-ink-soft)", fontWeight: 600 }}>
                          {b.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="admin-icon-btn" type="button" aria-label="Edit" onClick={() => openEdit(b)}>
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="admin-icon-btn admin-icon-btn--danger"
                          type="button"
                          aria-label="Delete"
                          onClick={() => setPendingDelete(b)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <BrandFormModal brand={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this brand?"
        description={
          pendingDelete
            ? pendingDelete.count > 0
              ? `"${pendingDelete.name}" has ${pendingDelete.count} product(s) — reassign them first.`
              : `"${pendingDelete.name}" will be permanently removed.`
            : ""
        }
        confirmLabel={pendingDelete?.count > 0 ? "Understood" : "Delete"}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
