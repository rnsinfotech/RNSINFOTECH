import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import CategoryFormModal from "./CategoryFormModal";
import { getCategories, updateCategory, deleteCategory } from "../../services/categoriesService";
import PageLoader from "../../components/PageLoader";

export default function CategoriesListPage() {
  const { toast, showToast, clearToast } = useToast();
  const [categories, setCategories] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setCategories(await getCategories());
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(cat) {
    setEditing(cat);
    setShowForm(true);
  }

  function handleSaved(_saved, message) {
    setShowForm(false);
    showToast(message);
    load();
  }

  async function toggleStatus(cat) {
    await updateCategory(cat.id, { status: cat.status === "active" ? "inactive" : "active" });
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.count > 0) {
      showToast(`Can't delete "${pendingDelete.name}" — it still has ${pendingDelete.count} product(s).`, "danger");
      setPendingDelete(null);
      return;
    }
    await deleteCategory(pendingDelete.id);
    setPendingDelete(null);
    showToast(`Deleted "${pendingDelete.name}"`);
    load();
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Categories</h1>
          <p>Organize your catalogue into browsable categories.</p>
        </div>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd}>
          <Icon name="plus" size={15} />
          Add category
        </button>
      </div>

      {categories === null ? (
        <PageLoader />
      ) : categories.length === 0 ? (
        <EmptyState icon="tag" title="No categories yet" description="Add your first category to start organizing products." />
      ) : (
        <div className="admin-card" style={{ padding: 0 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Icon</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="admin-table__title-cell">
                        <img className="admin-table__thumb" src={c.image} alt="" onError={(e) => (e.target.style.visibility = "hidden")} />
                        <div>
                          <div className="admin-table__title-main">{c.name}</div>
                          <div className="admin-table__title-sub">{c.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Icon name={c.icon} size={17} style={{ color: "var(--admin-ink-soft)" }} />
                    </td>
                    <td>
                      <Badge tone="neutral">{c.count} product{c.count === 1 ? "" : "s"}</Badge>
                    </td>
                    <td>
                      <button
                        className={`admin-toggle${c.status === "active" ? " is-on" : ""}`}
                        type="button"
                        onClick={() => toggleStatus(c)}
                        aria-pressed={c.status === "active"}
                      >
                        <span className="admin-toggle__track" />
                        <span style={{ fontSize: 12, color: "var(--admin-ink-soft)", fontWeight: 600 }}>
                          {c.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </button>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <CategoryFormModal category={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this category?"
        description={
          pendingDelete
            ? pendingDelete.count > 0
              ? `"${pendingDelete.name}" has ${pendingDelete.count} product(s) — move or delete them first.`
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
