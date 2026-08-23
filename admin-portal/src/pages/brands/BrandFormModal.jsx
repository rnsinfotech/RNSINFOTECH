import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { createBrand, updateBrand } from "../../services/brandsService";

export default function BrandFormModal({ brand, onClose, onSaved }) {
  const isEdit = Boolean(brand);
  const [form, setForm] = useState({
    name: brand?.name || "",
    logo: brand?.logo || "",
    status: brand?.status || "active",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Brand name is required.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await updateBrand(brand.id, form);
        onSaved(updated, "Brand updated");
      } else {
        const created = await createBrand(form);
        onSaved(created, "Brand created");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 420, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{isEdit ? "Edit brand" : "Add brand"}</h3>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: "var(--admin-danger-tint)", color: "var(--admin-danger)", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="Name" htmlFor="brand-name" required>
              <input id="brand-name" className="admin-input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </FormField>

            <FormField label="Logo URL" htmlFor="brand-logo" hint="Path under /assets/brands, or any image URL.">
              <input id="brand-logo" className="admin-input" value={form.logo} onChange={(e) => set("logo", e.target.value)} placeholder="/assets/brands/example.png" />
            </FormField>

            <FormField label="Visibility" htmlFor="brand-status">
              <select id="brand-status" className="admin-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create brand"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
