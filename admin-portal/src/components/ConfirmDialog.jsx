import React from "react";
import Icon from "./Icon";

export default function ConfirmDialog({ open, title, description, confirmLabel = "Delete", onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div className="admin-modal admin-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__icon admin-modal__icon--danger">
          <Icon name="trash" size={18} />
        </div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        <div className="admin-modal__actions">
          <button className="admin-btn admin-btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="admin-btn admin-btn--danger" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
