import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { createCoupon, updateCoupon } from "../../services/couponsService";

export default function CouponFormModal({ coupon, onClose, onSaved }) {
  const isEdit = Boolean(coupon);
  const [form, setForm] = useState({
    code: coupon?.code || "",
    description: coupon?.description || "",
    type: coupon?.type || "percent",
    value: coupon?.value ?? "",
    minOrderValue: coupon?.minOrderValue ?? 0,
    usageLimit: coupon?.usageLimit ?? 0,
    maxUsesPerUser: coupon?.maxUsesPerUser ?? 0,
    expiresAt: coupon?.expiresAt || "",
    status: coupon?.status || "active",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.code.trim()) return setError("Coupon code is required.");
    const value = Number(form.value);
    if (!value || value <= 0) return setError("Enter a discount value greater than 0.");
    if (form.type === "percent" && value > 100) return setError("A percentage discount can't exceed 100.");

    const payload = {
      ...form,
      value,
      minOrderValue: Number(form.minOrderValue) || 0,
      usageLimit: Number(form.usageLimit) || 0,
      maxUsesPerUser: Number(form.maxUsesPerUser) || 0,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const updated = await updateCoupon(coupon.id, payload);
        onSaved(updated, "Coupon updated");
      } else {
        const created = await createCoupon(payload);
        onSaved(created, "Coupon created");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 480, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{isEdit ? "Edit coupon" : "Add coupon"}</h3>

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
            <FormField label="Code" htmlFor="cpn-code" required hint="Shown to customers at checkout — always stored uppercase.">
              <input
                id="cpn-code"
                className="admin-input"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                autoFocus
              />
            </FormField>

            <FormField label="Description" htmlFor="cpn-desc">
              <input
                id="cpn-desc"
                className="admin-input"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="10% off for first-time customers"
              />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormField label="Discount type" htmlFor="cpn-type">
                <select id="cpn-type" className="admin-select" value={form.type} onChange={(e) => set("type", e.target.value)}>
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Flat amount (₹)</option>
                </select>
              </FormField>
              <FormField label={form.type === "percent" ? "Discount %" : "Discount ₹"} htmlFor="cpn-value" required>
                <input
                  id="cpn-value"
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormField label="Min. order value (₹)" htmlFor="cpn-min" hint="0 = no minimum">
                <input
                  id="cpn-min"
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.minOrderValue}
                  onChange={(e) => set("minOrderValue", e.target.value)}
                />
              </FormField>
              <FormField label="Usage limit" htmlFor="cpn-limit" hint="0 = unlimited">
                <input
                  id="cpn-limit"
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.usageLimit}
                  onChange={(e) => set("usageLimit", e.target.value)}
                />
              </FormField>
              <FormField label="Max uses per customer" htmlFor="cpn-user-limit" hint="0 = unlimited per customer">
                <input
                  id="cpn-user-limit"
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.maxUsesPerUser}
                  onChange={(e) => set("maxUsesPerUser", e.target.value)}
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormField label="Expires on" htmlFor="cpn-expiry" hint="Leave blank for no expiry">
                <input
                  id="cpn-expiry"
                  type="date"
                  className="admin-input"
                  value={form.expiresAt}
                  onChange={(e) => set("expiresAt", e.target.value)}
                />
              </FormField>
              <FormField label="Status" htmlFor="cpn-status">
                <select id="cpn-status" className="admin-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
