import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";

const ICON_OPTIONS = [
  "truck",
  "headset",
  "layers",
  "shield",
  "pen",
  "display",
  "tablet",
  "chip",
  "disc",
  "star",
  "check",
  "gear",
  "package",
  "tag",
];

export default function IconCardFormModal({ label, item, service, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    icon: item?.icon || "star",
    title: item?.title || "",
    body: item?.body || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await service.update(item.id, form);
        onSaved(`${label} updated`);
      } else {
        await service.create(form);
        onSaved(`${label} added`);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 440, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>
          {isEdit ? `Edit ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        </h3>

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
            <FormField label="Icon" htmlFor="ic-icon">
              <select id="ic-icon" className="admin-select" value={form.icon} onChange={(e) => set("icon", e.target.value)}>
                {ICON_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Title" htmlFor="ic-title" required>
              <input id="ic-title" className="admin-input" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
            </FormField>

            <FormField label="Body" htmlFor="ic-body">
              <textarea id="ic-body" className="admin-input" rows={3} value={form.body} onChange={(e) => set("body", e.target.value)} />
            </FormField>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : isEdit ? "Save changes" : `Add ${label.toLowerCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
