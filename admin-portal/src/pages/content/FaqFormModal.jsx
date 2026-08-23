import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { createFaq, updateFaq } from "../../services/contentService";

export default function FaqFormModal({ faq, onClose, onSaved }) {
  const isEdit = Boolean(faq);
  const [form, setForm] = useState({ q: faq?.q || "", a: faq?.a || "", isPublished: faq?.isPublished !== false, sortOrder: faq?.sortOrder || 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.q.trim() || !form.a.trim()) {
      setError("Both question and answer are required.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateFaq(faq.id, form);
        onSaved("FAQ updated");
      } else {
        await createFaq(form);
        onSaved("FAQ added");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 520, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{isEdit ? "Edit FAQ" : "Add FAQ"}</h3>

        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                background: "var(--admin-danger-tint)",
                color: "var(--admin-danger)",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12.5,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="Question" htmlFor="faq-q" required>
              <input id="faq-q" className="admin-input" value={form.q} onChange={(e) => set("q", e.target.value)} autoFocus />
            </FormField>
            <FormField label="Answer" htmlFor="faq-a" required>
              <textarea id="faq-a" className="admin-input" rows={4} value={form.a} onChange={(e) => set("a", e.target.value)} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormField label="Order" htmlFor="faq-order">
                <input id="faq-order" type="number" className="admin-input" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
              </FormField>
              <FormField label="Storefront status" htmlFor="faq-published">
                <select id="faq-published" className="admin-select" value={form.isPublished ? "published" : "draft"} onChange={(e) => set("isPublished", e.target.value === "published")}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </FormField>
            </div>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add FAQ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
