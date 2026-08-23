import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { createCategory, updateCategory, uploadCategoryImage } from "../../services/categoriesService";

const ICONS = ["display", "tablet", "pen", "layers", "package", "tag", "gear", "star"];

export default function CategoryFormModal({ category, onClose, onSaved }) {
  const isEdit = Boolean(category);
  const [form, setForm] = useState({
    name: category?.name || "",
    icon: category?.icon || "tag",
    status: category?.status || "active",
  });
  // Image is handled separately from the rest of the form: the backend
  // only accepts it via a multipart upload to /categories/:id/image
  // (it's stored as a Cloudinary {url, publicId} pair, not a plain
  // string field), so it can't ride along in the JSON create/update body.
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(category?.image || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Category name is required.");
      return;
    }
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        saved = await updateCategory(category.id, form);
      } else {
        saved = await createCategory(form);
      }
      // A brand-new category doesn't have an id until create() returns,
      // so the image upload always has to happen after (never before)
      // the create/update call above.
      if (imageFile && saved?.id) {
        saved = await uploadCategoryImage(saved.id, imageFile);
      }
      onSaved(saved, isEdit ? "Category updated" : "Category created");
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 440, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{isEdit ? "Edit category" : "Add category"}</h3>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: "var(--admin-danger-tint)", color: "var(--admin-danger)", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField label="Name" htmlFor="cat-name" required>
              <input id="cat-name" className="admin-input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </FormField>

            <FormField label="Icon" htmlFor="cat-icon">
              <select id="cat-icon" className="admin-select" value={form.icon} onChange={(e) => set("icon", e.target.value)}>
                {ICONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Image" htmlFor="cat-image" hint="JPG or PNG, uploaded to storage.">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt=""
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid var(--admin-border)" }}
                  />
                )}
                <input id="cat-image" type="file" accept="image/*" className="admin-input" onChange={handleImagePick} />
              </div>
            </FormField>

            <FormField label="Visibility" htmlFor="cat-status">
              <select id="cat-status" className="admin-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="active">Active (shown in storefront nav)</option>
                <option value="inactive">Inactive (hidden)</option>
              </select>
            </FormField>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
