import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
const FLASH_TYPES = [
  { value: "login", label: "Login / account" },
  { value: "sale", label: "Sale / offer" },
  { value: "newsletter", label: "Newsletter" },
  { value: "custom", label: "Custom" },
];
import { createFlashMessage, updateFlashMessage } from "../../services/flashMessagesService";

export default function FlashMessageFormModal({ item, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    type: item?.type || "custom",
    message: item?.message || "",
    ctaLabel: item?.ctaLabel || "",
    ctaHref: item?.ctaHref || "",
    durationSeconds: item?.durationSeconds ?? 5,
    active: item?.active ?? true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.message.trim()) {
      setError("Message text is required.");
      return;
    }
    if (Number(form.durationSeconds) < 1 || Number(form.durationSeconds) > 120) {
      setError("Duration must be between 1 and 120 seconds.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, durationSeconds: Math.max(1, Number(form.durationSeconds) || 5) };
      if (isEdit) {
        await updateFlashMessage(item.id, payload);
        onSaved("Flash message updated");
      } else {
        await createFlashMessage(payload);
        onSaved("Flash message added");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 480, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>{isEdit ? "Edit flash message" : "Add flash message"}</h3>
        <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 16 }}>
          Shown in the rotating strip above the storefront's navbar, on every page.
        </p>

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
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <FormField label="Type" htmlFor="fm-type">
                <select id="fm-type" className="admin-select" value={form.type} onChange={(e) => set("type", e.target.value)}>
                  {FLASH_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Shown for (seconds)" htmlFor="fm-duration" hint="How long before the next active message takes over.">
                <input
                  id="fm-duration"
                  type="number"
                  min={1}
                  max={120}
                  className="admin-input"
                  value={form.durationSeconds}
                  onChange={(e) => set("durationSeconds", e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Message" htmlFor="fm-message" required>
              <textarea
                id="fm-message"
                className="admin-input"
                rows={2}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                autoFocus
              />
            </FormField>

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <FormField label="CTA label" htmlFor="fm-cta-label" hint="Leave blank to hide the link.">
                <input id="fm-cta-label" className="admin-input" value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
              </FormField>
              <FormField label="CTA link" htmlFor="fm-cta-href">
                <input id="fm-cta-href" className="admin-input" value={form.ctaHref} onChange={(e) => set("ctaHref", e.target.value)} placeholder="/products" />
              </FormField>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} style={{ accentColor: "var(--rns-primary)" }} />
              Active — included in the storefront's rotation
            </label>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add flash message"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
