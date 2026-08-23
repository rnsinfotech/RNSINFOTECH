import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { getCommerceSettings, updateCommerceSettings } from "../../services/settingsService";
import PageLoader from "../../components/PageLoader";

// Three numbers that used to live hardcoded in source files —
// frontend.zip's CheckoutPage.jsx (free-shipping threshold/fee) and
// this app's productsService.js (deriveStockLabel's low-stock cutoff,
// now read via settingsService.getLowStockThresholdSync instead of a
// literal 8). The storefront backend reads these persisted values when calculating checkout pricing.
export default function CommerceTab() {
  const { toast, showToast, clearToast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCommerceSettings().then(setForm);
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateCommerceSettings({
        freeShippingThreshold: Number(form.freeShippingThreshold) || 0,
        flatShippingFee: Number(form.flatShippingFee) || 0,
        lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 0),
        taxRate: Math.max(0, Number(form.taxRate) || 0),
        standardDeliveryFee: Math.max(0, Number(form.standardDeliveryFee) || 0),
      });
      if (updated) setForm(updated);
      showToast("Commerce settings updated");
    } catch (error) {
      showToast(error?.message || "Unable to update commerce settings", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <PageLoader />;

  return (
    <form onSubmit={handleSubmit} className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Shipping</h3>
      <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 14 }}>
        These persisted commerce rules are used by the storefront backend pricing engine.
      </p>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <FormField label="Free shipping above" htmlFor="cs-threshold" hint="Order subtotal, in ₹.">
          <input
            id="cs-threshold"
            type="number"
            min="0"
            className="admin-input"
            value={form.freeShippingThreshold}
            onChange={(e) => set("freeShippingThreshold", e.target.value)}
          />
        </FormField>
        <FormField label="Flat shipping fee" htmlFor="cs-fee" hint="Charged below the threshold, in ₹.">
          <input
            id="cs-fee"
            type="number"
            min="0"
            className="admin-input"
            value={form.flatShippingFee}
            onChange={(e) => set("flatShippingFee", e.target.value)}
          />
        </FormField>
      </div>

      <div className="admin-form-section" style={{ borderTop: "1px solid var(--admin-line)", paddingTop: 14, marginTop: 14 }}>
        <h3 style={{ marginBottom: 4 }}>Delivery & tax</h3>
        <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 14 }}>
          These values are persisted and used by the backend pricing engine for quotes, orders and payments.
        </p>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
          <FormField label="GST rate" htmlFor="cs-tax" hint="GST percentage, e.g. 18 for 18%. Product prices are treated as GST-exclusive.">
            <input id="cs-tax" type="number" min="0" step="0.01" className="admin-input"
              value={form.taxRate ?? 0} onChange={(e) => set("taxRate", e.target.value)} />
          </FormField>
          <FormField label="Delivery fee" htmlFor="cs-standard" hint="Charged on every order, in ₹. Delivery is no longer a customer choice — every order ships within 3-4 days at this one fee.">
            <input id="cs-standard" type="number" min="0" step="0.01" className="admin-input"
              value={form.standardDeliveryFee ?? 0} onChange={(e) => set("standardDeliveryFee", e.target.value)} />
          </FormField>
        </div>
      </div>

      <div className="admin-form-section" style={{ borderTop: "1px solid var(--admin-line)", paddingTop: 14, marginTop: 14 }}>
        <h3 style={{ fontSize: 13, marginBottom: 4 }}>Inventory</h3>
        <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 10 }}>
          A product shows as "low stock" at or below this quantity, everywhere it's shown across the admin
          (Products, Inventory, Dashboard).
        </p>
        <FormField label="Low-stock threshold" htmlFor="cs-lowstock" hint="Units remaining.">
          <input
            id="cs-lowstock"
            type="number"
            min="0"
            className="admin-input"
            style={{ maxWidth: 160 }}
            value={form.lowStockThreshold}
            onChange={(e) => set("lowStockThreshold", e.target.value)}
          />
        </FormField>
      </div>

      <div className="admin-form-actions" style={{ marginTop: 14, paddingTop: 0, borderTop: "none" }}>
        <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
          <Icon name="check" size={14} />
          {saving ? "Saving…" : "Save commerce settings"}
        </button>
      </div>
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </form>
  );
}
