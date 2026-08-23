import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import TestimonialFormModal from "./TestimonialFormModal";
import { getTestimonials, deleteTestimonial } from "../../services/websiteService";
import PageLoader from "../../components/PageLoader";

function Stars({ rating }) {
  return (
    <div style={{ display: "flex", gap: 2, color: "var(--admin-warning)" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={13} style={{ opacity: i < rating ? 1 : 0.25 }} />
      ))}
    </div>
  );
}

export default function TestimonialsTab() {
  const { toast, showToast, clearToast } = useToast();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setItems(await getTestimonials());
  }

  useEffect(() => {
    load();
  }, []);

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
    await deleteTestimonial(pendingDelete.id);
    setPendingDelete(null);
    showToast(`Deleted testimonial from "${pendingDelete.name}"`);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd}>
          <Icon name="plus" size={15} />
          Add testimonial
        </button>
      </div>

      {items === null ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState icon="star" title="No testimonials yet" description="Add one to show it on the storefront homepage." />
      ) : (
        <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {items.map((t) => (
            <div key={t.id} className="admin-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Stars rating={t.rating} />
                <div className="admin-table__actions">
                  <button className="admin-icon-btn" type="button" aria-label="Edit" onClick={() => openEdit(t)}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    className="admin-icon-btn admin-icon-btn--danger"
                    type="button"
                    aria-label="Delete"
                    onClick={() => setPendingDelete(t)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.55, margin: "10px 0 12px", color: "var(--admin-ink)" }}>"{t.quote}"</p>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "var(--admin-ink-faint)" }}>{t.role}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && <TestimonialFormModal item={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this testimonial?"
        description={pendingDelete ? `The testimonial from "${pendingDelete.name}" will be permanently removed.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
