import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import StatusToggle from "../../components/StatusToggle";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import FlashMessageFormModal from "./FlashMessageFormModal";
import { getFlashMessages, updateFlashMessage, deleteFlashMessage, reorderFlashMessages } from "../../services/flashMessagesService";
import PageLoader from "../../components/PageLoader";

const FLASH_TYPES = [
  { value: "login", label: "Login / account" },
  { value: "sale", label: "Sale / offer" },
  { value: "newsletter", label: "Newsletter" },
  { value: "custom", label: "Custom" },
];

const TYPE_TONE = {
  login: "info",
  sale: "danger",
  newsletter: "success",
  custom: "neutral",
};

function typeLabel(type) {
  return FLASH_TYPES.find((t) => t.value === type)?.label || type;
}

/**
 * FlashMessagesTab — manage the rotating strip shown above the
 * storefront's navbar. Any number of messages can be active at once;
 * the storefront cycles through them in list order, each shown for its
 * own `durationSeconds`. `type` (login/sale/newsletter/custom) is free
 * to mix with any message/CTA — it only picks the accent color/icon
 * shown on the storefront.
 */
export default function FlashMessagesTab() {
  const { toast, showToast, clearToast } = useToast();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setItems(await getFlashMessages());
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(item) {
    setEditing(item);
    setShowForm(true);
  }
  function handleSaved(message) {
    setShowForm(false);
    showToast(message);
    load();
  }
  async function moveItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      const next = await reorderFlashMessages(ids);
      setItems(next);
    } catch (err) {
      showToast(err.message || "Unable to reorder flash messages.", "danger");
    }
  }

  async function toggleActive(item) {
    await updateFlashMessage(item.id, { active: !item.active });
    load();
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteFlashMessage(pendingDelete.id);
    setPendingDelete(null);
    showToast("Flash message deleted");
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
        <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", maxWidth: 520 }}>
          Shown above the storefront's navbar on every page. Add as many as you like — active
          messages rotate in list order, each staying on screen for its own duration.
        </p>
        <button className="admin-btn admin-btn--primary" type="button" onClick={openAdd} style={{ flexShrink: 0 }}>
          <Icon name="plus" size={15} />
          Add flash message
        </button>
      </div>

      {items === null ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title="No flash messages yet" description="Add one — a sale, a login nudge, a newsletter prompt, anything." />
      ) : (
        <div className="admin-card" style={{ padding: 0 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Message</th>
                  <th>CTA</th>
                  <th>Duration</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Badge tone={TYPE_TONE[item.type] || "neutral"}>{typeLabel(item.type)}</Badge>
                    </td>
                    <td style={{ maxWidth: 340 }}>
                      <div className="admin-table__title-main" style={{ whiteSpace: "normal" }}>
                        {item.message}
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--admin-ink-soft)" }}>
                      {item.ctaLabel ? `${item.ctaLabel} → ${item.ctaHref || "—"}` : "—"}
                    </td>
                    <td>{item.durationSeconds}s</td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="admin-icon-btn" type="button" aria-label="Move up" disabled={items.indexOf(item) === 0} onClick={() => moveItem(items.indexOf(item), -1)}>↑</button>
                        <button className="admin-icon-btn" type="button" aria-label="Move down" disabled={items.indexOf(item) === items.length - 1} onClick={() => moveItem(items.indexOf(item), 1)}>↓</button>
                      </div>
                    </td>
                    <td>
                      <StatusToggle active={item.active} onChange={() => toggleActive(item)} />
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="admin-icon-btn" type="button" aria-label="Edit" onClick={() => openEdit(item)}>
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="admin-icon-btn admin-icon-btn--danger"
                          type="button"
                          aria-label="Delete"
                          onClick={() => setPendingDelete(item)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <FlashMessageFormModal item={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this flash message?"
        description={pendingDelete ? `"${pendingDelete.message}" will stop showing on the storefront.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </div>
  );
}
