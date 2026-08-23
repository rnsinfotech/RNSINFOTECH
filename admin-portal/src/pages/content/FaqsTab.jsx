import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import FaqFormModal from "./FaqFormModal";
import { getFaqs, deleteFaq, previewFaq } from "../../services/contentService";
import ContentPreviewModal from "./ContentPreviewModal";
import PageLoader from "../../components/PageLoader";

export default function FaqsTab() {
  const { toast, showToast, clearToast } = useToast();
  const [faqs, setFaqs] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [preview, setPreview] = useState(null);

  async function load() {
    setFaqs(await getFaqs());
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(faq) {
    setEditing(faq);
    setShowForm(true);
  }
  function handleSaved(message) {
    setShowForm(false);
    showToast(message);
    load();
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteFaq(pendingDelete.id);
    setPendingDelete(null);
    showToast("FAQ deleted");
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)" }}>
          Shown on the storefront's Help page FAQ section.
        </p>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd}>
          <Icon name="plus" size={15} />
          Add FAQ
        </button>
      </div>

      {faqs === null ? (
        <PageLoader />
      ) : faqs.length === 0 ? (
        <EmptyState icon="fileText" title="No FAQs yet" description="Add your first question and answer." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqs.map((f) => (
            <div key={f.id} className="admin-card" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ fontWeight: 600, fontSize: 14 }}>{f.q}</div><span className="admin-badge">{f.isPublished ? "Published" : "Draft"}</span></div>
                <div style={{ fontSize: 12.5, color: "var(--admin-ink-soft)", marginTop: 4, lineHeight: 1.55 }}>{f.a}</div>
              </div>
              <div className="admin-table__actions" style={{ flexShrink: 0 }}>
                <button className="admin-icon-btn" type="button" aria-label="Edit" onClick={() => openEdit(f)}>
                  <Icon name="edit" size={14} />
                </button>
                <button
                  className="admin-icon-btn admin-icon-btn--danger"
                  type="button"
                  aria-label="Delete"
                  onClick={() => setPendingDelete(f)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <FaqFormModal faq={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this FAQ?"
        description={pendingDelete ? `"${pendingDelete.q}" will be permanently removed.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      {preview && <ContentPreviewModal type="faq" item={preview} onClose={() => setPreview(null)} />}
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
