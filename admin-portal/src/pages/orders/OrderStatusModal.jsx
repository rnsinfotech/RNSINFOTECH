import React, { useState } from "react";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import FormField from "../../components/FormField";
import { ORDER_STATUSES } from "../../lib/orderStatuses";
import { updateOrderStatus } from "../../services/ordersService";
import { STATUS_TONE, statusLabel } from "../../utils/format";

export default function OrderStatusModal({ order, onClose, onSaved }) {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const updated = await updateOrderStatus(order.id, status);
    onSaved(updated);
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: 400, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>Update order status</h3>
        <p style={{ marginBottom: 16 }}>
          {order.id} <span style={{ color: "var(--admin-ink-faint)" }}>· {order.shippingAddress.name}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <FormField label="Status" htmlFor="order-status">
            <select
              id="order-status"
              className="admin-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </FormField>

          <div style={{ marginTop: 10 }}>
            <Badge tone={STATUS_TONE[status]}>{statusLabel(status)}</Badge>
          </div>

          <div className="admin-modal__actions">
            <button className="admin-btn admin-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-btn admin-btn--primary" type="submit" disabled={saving || status === order.status}>
              <Icon name="check" size={14} />
              {saving ? "Saving…" : "Save status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
