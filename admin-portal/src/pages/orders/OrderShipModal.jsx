import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { shipOrder } from "../../services/ordersService";

// A handful of common Indian couriers to pick from, plus "Other" for
// anything not listed — kept as free text either way so this never
// blocks on an unlisted courier.
const COMMON_COURIERS = ["Delhivery", "Blue Dart", "DTDC", "Ekart Logistics", "Xpressbees", "India Post"];

export default function OrderShipModal({ order, onClose, onSaved }) {
  const [courierName, setCourierName] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!courierName.trim() || !trackingId.trim()) {
      setError("Courier name and tracking ID are both required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await shipOrder(order.id, { courierName, trackingId });
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 420, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>Mark as shipped</h3>
        <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 16 }}>
          {order.id} <span>· {order.shippingAddress.name}</span>
          <br />
          The customer sees this courier + tracking ID immediately — once shipped, RNS INFOTECH's part in this order is done.
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
            <FormField label="Courier company" htmlFor="ship-courier" required>
              <input
                id="ship-courier"
                className="admin-input"
                list="ship-courier-options"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. Blue Dart"
                autoFocus
              />
              <datalist id="ship-courier-options">
                {COMMON_COURIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FormField>

            <FormField label="Tracking ID" htmlFor="ship-tracking" required>
              <input
                id="ship-tracking"
                className="admin-input"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="e.g. BD481923650IN"
              />
            </FormField>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="truck" size={14} />
              {saving ? "Saving…" : "Mark as shipped"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
