import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import IconCardFormModal from "./IconCardFormModal";
import PageLoader from "../../components/PageLoader";

// Shared by WhyChooseUsTab and SolutionsTab — both are the same
// icon+title+body list shape (see mock/websiteMock.js), just backed by
// different service functions and copy. Keeping one component avoids
// three/four near-duplicate list pages for what's structurally the same
// screen (same pattern reasoning as Inventory wrapping productsService
// instead of owning a parallel model).
export default function IconCardsListTab({ label, emptyIcon, service }) {
  const { toast, showToast, clearToast } = useToast();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setItems(await service.list());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(item) {
    setEditing(item);
    setShowForm(true);
  }
  function handleSaved(message) {
    setShowForm(false);
    showToast(message);
    load();
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    await service.remove(pendingDelete.id);
    setPendingDelete(null);
    showToast(`Deleted "${pendingDelete.title}"`);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd}>
          <Icon name="plus" size={15} />
          Add {label.toLowerCase()}
        </button>
      </div>

      {items === null ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState icon={emptyIcon} title={`No ${label.toLowerCase()} yet`} description={`Add one to show it on the storefront homepage.`} />
      ) : (
        <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {items.map((item) => (
            <div key={item.id} className="admin-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "var(--rns-primary-tint)",
                    color: "var(--rns-primary-dark)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name={item.icon} size={16} />
                </div>
                <div className="admin-table__actions">
                  <button className="admin-icon-btn" type="button" aria-label="Edit" onClick={() => openEdit(item)}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    className="admin-icon-btn admin-icon-btn--danger"
                    type="button"
                    aria-label="Delete"
                    onClick={() => setPendingDelete(item)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, margin: "10px 0 4px" }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--admin-ink-soft)", lineHeight: 1.5 }}>{item.body}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <IconCardFormModal
          label={label}
          item={editing}
          service={service}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete this ${label.toLowerCase()}?`}
        description={pendingDelete ? `"${pendingDelete.title}" will be permanently removed from the homepage.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
