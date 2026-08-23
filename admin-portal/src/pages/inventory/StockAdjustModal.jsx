import React, { useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import { adjustStock } from "../../services/inventoryService";

const QUICK_REASONS = ["Restock", "Damaged", "Return", "Recount", "Sold offline"];

export default function StockAdjustModal({ product, onClose, onSaved }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const previewQty = Math.max(0, product.stockQty + delta);
  const willClamp = product.stockQty + delta < 0;

  function step(amount) {
    setDelta((d) => {
      const next = d + amount;
      return product.stockQty + next < 0 ? -product.stockQty : next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (delta === 0) {
      setError("Enter a quantity change before saving.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required for the adjustment log.");
      return;
    }
    setSaving(true);
    try {
      const { entry } = await adjustStock(product, delta, reason);
      onSaved(entry);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 440, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>Adjust stock</h3>
        <p style={{ marginBottom: 16 }}>
          {product.name} <span style={{ color: "var(--admin-ink-faint)" }}>· {product.sku}</span>
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
            <FormField label="Quantity change">
              <div className="admin-stepper">
                <button
                  type="button"
                  className="admin-stepper__btn"
                  onClick={() => step(-1)}
                  disabled={product.stockQty + delta <= 0}
                  aria-label="Decrease"
                >
                  <Icon name="minus" size={14} />
                </button>
                <input
                  className="admin-stepper__input"
                  type="number"
                  value={delta}
                  onChange={(e) => {
                    const raw = Number(e.target.value) || 0;
                    setDelta(product.stockQty + raw < 0 ? -product.stockQty : raw);
                  }}
                />
                <button type="button" className="admin-stepper__btn" onClick={() => step(1)} aria-label="Increase">
                  <Icon name="plus" size={14} />
                </button>
              </div>
              <div className="admin-adjust-preview">
                <span>{product.stockQty} units</span>
                <Icon name="arrowRight" size={13} />
                <span className={delta === 0 ? "" : delta > 0 ? "is-up" : "is-down"}>{previewQty} units</span>
                {willClamp && <span className="admin-adjust-preview__note">(clamped at 0)</span>}
              </div>
            </FormField>

            <FormField label="Reason" htmlFor="adj-reason" required>
              <input
                id="adj-reason"
                className="admin-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Restock from supplier, damaged unit, recount…"
                autoFocus
              />
            </FormField>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="admin-btn admin-btn--ghost admin-btn--sm"
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : "Save adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
