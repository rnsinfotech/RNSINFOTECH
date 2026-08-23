import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { getStoreProfile, updateStoreProfile } from "../../services/settingsService";
import PageLoader from "../../components/PageLoader";

// This is the shape that flows through to the storefront's contact
// details, Help page, and invoice footer via GET /store-profile — see
// frontend's context/SiteSettingsContext.jsx.
export default function StoreProfileTab() {
  const { toast, showToast, clearToast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStoreProfile().then(setForm);
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateStoreProfile(form);
      if (updated) setForm(updated);
      showToast("Store profile updated");
    } catch (error) {
      showToast(error?.message || "Unable to update store profile", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <PageLoader />;

  return (
    <form onSubmit={handleSubmit} className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Business identity</h3>
      <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 14 }}>
        Persisted in MongoDB and used by the storefront's Help page, footer, and invoice data.
      </p>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <FormField label="Display name" htmlFor="sp-name" required>
          <input id="sp-name" className="admin-input" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </FormField>
        <FormField label="Legal name" htmlFor="sp-legal" hint="Used on invoices, not shown on the storefront.">
          <input id="sp-legal" className="admin-input" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
        </FormField>
        <FormField label="Support email" htmlFor="sp-email" required>
          <input id="sp-email" type="email" className="admin-input" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </FormField>
        <FormField label="Support phone" htmlFor="sp-phone">
          <input id="sp-phone" className="admin-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </FormField>
        <FormField label="WhatsApp number" htmlFor="sp-whatsapp" hint="Digits only, country code first — e.g. 919876543210.">
          <input id="sp-whatsapp" className="admin-input" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </FormField>
        <FormField label="Support hours" htmlFor="sp-hours">
          <input id="sp-hours" className="admin-input" value={form.hours} onChange={(e) => set("hours", e.target.value)} />
        </FormField>
        <FormField label="GSTIN" htmlFor="sp-gstin" hint="Optional — shown on invoices when set.">
          <input id="sp-gstin" className="admin-input" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
        </FormField>
        <FormField label="Business state" htmlFor="sp-state">
          <input id="sp-state" className="admin-input" value={form.state || ""} onChange={(e) => set("state", e.target.value)} />
        </FormField>
        <FormField label="Business city" htmlFor="sp-city">
          <input id="sp-city" className="admin-input" value={form.city || ""} onChange={(e) => set("city", e.target.value)} />
        </FormField>
        <FormField label="Business pincode" htmlFor="sp-pincode">
          <input id="sp-pincode" className="admin-input" value={form.pincode || ""} onChange={(e) => set("pincode", e.target.value)} />
        </FormField>
        <FormField label="Address" htmlFor="sp-address" full>
          <textarea id="sp-address" className="admin-input" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
        </FormField>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginTop: 10 }}>
        GST invoices use this business state and the customer's delivery state to determine CGST/SGST versus IGST.
      </p>
      <div className="admin-form-actions" style={{ marginTop: 14, paddingTop: 0, borderTop: "none" }}>
        <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
          <Icon name="check" size={14} />
          {saving ? "Saving…" : "Save store profile"}
        </button>
      </div>
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </form>
  );
}
