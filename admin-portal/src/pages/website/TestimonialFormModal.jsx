import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { createTestimonial, updateTestimonial } from "../../services/websiteService";

export default function TestimonialFormModal({ item, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    quote: item?.quote || "",
    name: item?.name || "",
    role: item?.role || "",
    rating: item?.rating || 5,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.quote.trim() || !form.name.trim()) {
      setError("Quote and name are required.");
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, rating: Number(form.rating) };
      if (isEdit) {
        await updateTestimonial(item.id, data);
        onSaved("Testimonial updated");
      } else {
        await createTestimonial(data);
        onSaved("Testimonial added");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 460, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{isEdit ? "Edit testimonial" : "Add testimonial"}</h3>

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
            <FormField label="Quote" htmlFor="t-quote" required>
              <textarea id="t-quote" className="admin-input" rows={3} value={form.quote} onChange={(e) => set("quote", e.target.value)} autoFocus />
            </FormField>

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <FormField label="Name" htmlFor="t-name" required>
                <input id="t-name" className="admin-input" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </FormField>
              <FormField label="Role / company" htmlFor="t-role">
                <input id="t-role" className="admin-input" value={form.role} onChange={(e) => set("role", e.target.value)} />
              </FormField>
            </div>

            <FormField label="Rating" htmlFor="t-rating">
              <select id="t-rating" className="admin-select" value={form.rating} onChange={(e) => set("rating", e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add testimonial"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
