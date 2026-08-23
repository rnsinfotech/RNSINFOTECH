import PermissionBoundary from "../../components/PermissionBoundary";
import React, { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import StatCard from "../../components/StatCard";
import useToast from "../../hooks/useToast";
import { STATUS_TONE, statusLabel } from "../../utils/format";
import { getLeads, getLeadStats, setLeadStatus, deleteLead } from "../../services/leadsService";
import PageLoader from "../../components/PageLoader";

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "quote", label: "Quotes & bulk pricing", icon: "fileText" },
  { key: "demo", label: "Demo requests", icon: "calendar" },
  { key: "contact", label: "Messages", icon: "message" },
  { key: "newsletter", label: "Newsletter", icon: "send" },
];

const STATUS_TABS = [
  { key: "all", label: "All statuses" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "closed", label: "Closed" },
];

// Quote-type leads carry products/quantity in `meta` — that's also where a
// "Corporate & Bulk Sales" submission shows up, since CorporateSalesPage
// reuses the /request-quote form rather than having its own endpoint.
function MetaDetails({ lead }) {
  const entries = Object.entries(lead.meta || {}).filter(([, v]) => v !== "" && v != null);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {entries.map(([key, value]) => (
        <span
          key={key}
          style={{
            fontSize: 12,
            padding: "3px 8px",
            borderRadius: 6,
            background: "var(--admin-neutral-tint)",
            color: "var(--admin-ink-soft)",
          }}
        >
          <strong style={{ fontWeight: 600 }}>{statusLabel(key)}:</strong> {String(value)}
        </span>
      ))}
    </div>
  );
}

export default function LeadsListPage() {
  const { toast, showToast, clearToast } = useToast();
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [typeTab, setTypeTab] = useState("all");
  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  async function load() {
    setError("");
    try {
      const [items, s] = await Promise.all([
        getLeads({ type: typeTab, status: statusTab, search }),
        getLeadStats(),
      ]);
      setLeads(items);
      setStats(s);
    } catch (err) {
      setLeads(null);
      setError(err.message || "Unable to load leads.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeTab, statusTab]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => leads || [], [leads]);

  async function act(id, status) {
    await setLeadStatus(id, status);
    showToast(`Marked as ${statusLabel(status).toLowerCase()}`);
    load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteLead(pendingDelete.id);
    setPendingDelete(null);
    showToast("Lead deleted");
    load();
  }

  return (
    <PermissionBoundary permission="leads.write">
      <div>
        <div className="admin-page-header">
          <div>
            <h1>Leads</h1>
            <p>
              Quote requests (including bulk pricing asks), demo bookings, contact-form messages, and
              newsletter signups sent from the storefront.
            </p>
          </div>
        </div>

        {stats && (
          <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
            <StatCard label="New" value={stats.new} icon="inbox" />
            <StatCard label="Contacted" value={stats.contacted} icon="clock" />
            <StatCard label="Closed" value={stats.closed} icon="check" />
            <StatCard label="Quotes & bulk pricing" value={stats.byType?.quote ?? 0} icon="fileText" />
          </div>
        )}

        <div className="admin-toolbar">
          <div className="admin-toolbar__search">
            <Icon name="search" size={15} />
            <input
              className="admin-input"
              placeholder="Search name, email, company, or message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="admin-segmented admin-segmented--sm">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`admin-segmented__btn${statusTab === t.key ? " is-active" : ""}`}
                onClick={() => setStatusTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-segmented" style={{ marginBottom: 16 }}>
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`admin-segmented__btn${typeTab === t.key ? " is-active" : ""}`}
              onClick={() => setTypeTab(t.key)}
            >
              {t.icon && <Icon name={t.icon} size={13} style={{ marginRight: 5 }} />}
              {t.label}
              {stats && t.key !== "all" ? ` (${stats.byType?.[t.key] ?? 0})` : ""}
            </button>
          ))}
        </div>

        {error ? (
          <div className="admin-card">
            <div style={{ color: "var(--admin-danger)", marginBottom: 12 }}>{error}</div>
            <button className="admin-btn admin-btn--ghost" type="button" onClick={load}>
              Try again
            </button>
          </div>
        ) : leads === null ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No leads here"
            description="Nothing matches this view right now. New quote requests, demo bookings, and messages from the storefront will show up here."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((lead) => (
              <div key={lead.id} className="admin-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong>{lead.name || lead.email}</strong>
                      <Badge tone="info">{TYPE_TABS.find((t) => t.key === lead.type)?.label || statusLabel(lead.type)}</Badge>
                      <Badge tone={STATUS_TONE[lead.status]}>{statusLabel(lead.status)}</Badge>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--admin-ink-soft)", marginTop: 2 }}>
                      {lead.email}
                      {lead.phone ? ` · ${lead.phone}` : ""}
                      {lead.company ? ` · ${lead.company}` : ""}
                      {lead.date ? ` · ${lead.date}` : ""}
                    </div>
                    {lead.message && <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55 }}>{lead.message}</p>}
                    <MetaDetails lead={lead} />
                  </div>
                  <div className="admin-table__actions" style={{ flexShrink: 0 }}>
                    {lead.status !== "contacted" && (
                      <button
                        className="admin-icon-btn"
                        type="button"
                        aria-label="Mark contacted"
                        title="Mark contacted"
                        onClick={() => act(lead.id, "contacted")}
                      >
                        <Icon name="clock" size={14} />
                      </button>
                    )}
                    {lead.status !== "closed" && (
                      <button
                        className="admin-icon-btn"
                        type="button"
                        aria-label="Mark closed"
                        title="Mark closed"
                        onClick={() => act(lead.id, "closed")}
                      >
                        <Icon name="check" size={14} />
                      </button>
                    )}
                    {lead.status !== "new" && (
                      <button
                        className="admin-icon-btn"
                        type="button"
                        aria-label="Mark new"
                        title="Mark new"
                        onClick={() => act(lead.id, "new")}
                      >
                        <Icon name="refresh" size={14} />
                      </button>
                    )}
                    <button
                      className="admin-icon-btn admin-icon-btn--danger"
                      type="button"
                      aria-label="Delete"
                      title="Delete"
                      onClick={() => setPendingDelete(lead)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          open={!!pendingDelete}
          title="Delete this lead?"
          description={pendingDelete ? `The submission from "${pendingDelete.name || pendingDelete.email}" will be permanently removed.` : ""}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
        <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
      </div>
    </PermissionBoundary>
  );
}
