import React, { useState } from "react";
import Field from "./Field";
import { EMPTY_ADDRESS, validateAddress } from "../lib/address";

export default function AddressForm({ initial, onSave, onCancel, saveLabel = "Save address" }) {
  const [address, setAddress] = useState(initial || EMPTY_ADDRESS);
  const [errors, setErrors] = useState({});

  function updateField(field, value) {
    setAddress((a) => ({ ...a, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }

  function handleSave() {
    const nextErrors = validateAddress(address);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSave(address);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="rns-address-form-grid" style={{ display: "grid", gap: 14 }}>
        <Field label="Full name" value={address.name} onChange={(v) => updateField("name", v)} error={errors.name} />
        <Field
          label="Phone number"
          value={address.phone}
          onChange={(v) => updateField("phone", v)}
          error={errors.phone}
          inputMode="numeric"
          maxLength={10}
        />
        <Field label="Address" value={address.line1} onChange={(v) => updateField("line1", v)} error={errors.line1} full />
        <Field label="City" value={address.city} onChange={(v) => updateField("city", v)} error={errors.city} />
        <Field label="State" value={address.state} onChange={(v) => updateField("state", v)} error={errors.state} />
        <Field
          label="Pincode"
          value={address.pincode}
          onChange={(v) => updateField("pincode", v)}
          error={errors.pincode}
          inputMode="numeric"
          maxLength={6}
        />
        <Field
          label="GSTIN (optional)"
          value={address.gstin || ""}
          onChange={(v) => updateField("gstin", v.toUpperCase())}
          error={errors.gstin}
          maxLength={15}
        />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSave} className="rns-btn rns-btn--primary">
          {saveLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rns-btn rns-btn--ghost" type="button">
            Cancel
          </button>
        )}
      </div>

      <style>{`
        .rns-address-form-grid { grid-template-columns: 1fr 1fr; }
        .rns-address-form-grid > [data-full="true"] { grid-column: 1 / -1; }
        @media (max-width: 560px) {
          .rns-address-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
