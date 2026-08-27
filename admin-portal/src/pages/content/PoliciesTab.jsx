import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { getPolicies, updatePolicy, publishPolicy, previewPolicy, POLICY_LABELS } from "../../services/contentService";
import ContentPreviewModal from "./ContentPreviewModal";
import PageLoader from "../../components/PageLoader";

const PAGES = Object.keys(POLICY_LABELS);

export default function PoliciesTab() {
  const { toast, showToast, clearToast } = useToast();
  const [policies, setPolicies] = useState(null);
  const [page, setPage] = useState("privacy");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { getPolicies().then(setPolicies); }, []);

  useEffect(() => {
    if (policies) setForm(policies[page].draft || { updated: "August 2026", description: "" });
  }, [policies, page]);

  async function handlePreview() {
    setPreview(await previewPolicy(page));
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const next = await publishPolicy(page);
      setPolicies(next);
      showToast(`${POLICY_LABELS[page]} published`);
    } finally {
      setPublishing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await updatePolicy(page, {
        description: form.description || "",
        updated: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      });
      setPolicies(next);
      showToast(`${POLICY_LABELS[page]} updated`);
    } finally {
      setSaving(false);
    }
  }

  if (!policies || !form) return <PageLoader />;

  return (
    <div>
      <div className="admin-segmented admin-segmented--sm" style={{ marginBottom: 16 }}>
        {PAGES.map((p) => (
          <button key={p} type="button" className={`admin-segmented__btn${page === p ? " is-active" : ""}`} onClick={() => setPage(p)}>
            {POLICY_LABELS[p]}
          </button>
        ))}
      </div>

      {toast?.message && <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />}

      <form onSubmit={handleSubmit} className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div>
            <h3>{POLICY_LABELS[page]}</h3>
            <div style={{ fontSize: 12, color: "var(--admin-ink-faint)", marginTop: 4 }}>
              Write the complete policy as one plain-text description. Line breaks are preserved exactly on the public page.
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--admin-ink-faint)" }}>
            Status: {policies[page].status} · {policies[page].publishedAt ? `Published ${new Date(policies[page].publishedAt).toLocaleDateString("en-IN")}` : "Not published"}
          </span>
        </div>

        <FormField label="Policy description" htmlFor="policy-description" full>
          <textarea
            id="policy-description"
            className="admin-input"
            rows={28}
            value={form.description || ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Enter the complete policy text here..."
            style={{ minHeight: 520, lineHeight: 1.65, resize: "vertical", fontFamily: "var(--admin-font-body, inherit)" }}
          />
        </FormField>

        <div style={{ marginTop: 8, fontSize: 12, color: "var(--admin-ink-faint)" }}>
          {String(form.description || "").length.toLocaleString("en-IN")} / 50,000 characters
        </div>

        <div className="admin-form-actions" style={{ marginTop: 18 }}>
          <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
            <Icon name="check" size={14} />
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={handlePreview}>
            <Icon name="search" size={14} />
            Preview draft
          </button>
          <button className="admin-btn admin-btn--primary" type="button" onClick={handlePublish} disabled={publishing || policies[page].status === "published"}>
            <Icon name="check" size={14} />
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>
      {preview && <ContentPreviewModal type="policy" item={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
