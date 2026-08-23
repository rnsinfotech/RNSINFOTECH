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

  useEffect(() => {
    getPolicies().then(setPolicies);
  }, []);

  useEffect(() => {
    if (policies) setForm(policies[page].draft || {});
  }, [policies, page]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setSection(i, field, value) {
    setForm((f) => ({ ...f, sections: f.sections.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }));
  }
  function addSection() {
    setForm((f) => ({ ...f, sections: [...f.sections, { title: "", body: "" }] }));
  }
  function removeSection(i) {
    setForm((f) => ({ ...f, sections: f.sections.filter((_, idx) => idx !== i) }));
  }

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
    const next = await updatePolicy(page, {
      ...form,
      updated: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    });
    setPolicies(next);
    setSaving(false);
    showToast(`${POLICY_LABELS[page]} updated`);
  }

  if (!policies || !form) return <PageLoader />;

  return (
    <div>
      <div className="admin-segmented admin-segmented--sm" style={{ marginBottom: 16 }}>
        {PAGES.map((p) => (
          <button
            key={p}
            type="button"
            className={`admin-segmented__btn${page === p ? " is-active" : ""}`}
            onClick={() => setPage(p)}
          >
            {POLICY_LABELS[p]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h3>{POLICY_LABELS[page]}</h3>
          <span style={{ fontSize: 12, color: "var(--admin-ink-faint)" }}>Status: {policies[page].status} · {policies[page].publishedAt ? `Published ${new Date(policies[page].publishedAt).toLocaleDateString("en-IN")}` : "Not published"}</span>
        </div>

        <FormField label="Intro" htmlFor="pol-intro" full>
          <textarea id="pol-intro" className="admin-input" rows={3} value={form.intro} onChange={(e) => set("intro", e.target.value)} />
        </FormField>

        {form.coverage && (
          <div style={{ marginTop: 14, padding: 12, background: "var(--admin-neutral-tint)", borderRadius: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Coverage table (read-only)</div>
            <div style={{ fontSize: 12, color: "var(--admin-ink-soft)" }}>
              {form.coverage.map((c) => (
                <div key={c.categoryId} style={{ padding: "4px 0" }}>
                  {c.categoryLabel} — {c.duration}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {form.sections.map((s, i) => (
            <div key={i} style={{ border: "1px solid var(--admin-line)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <input
                  className="admin-input"
                  style={{ fontWeight: 600 }}
                  value={s.title}
                  placeholder="Section title"
                  onChange={(e) => setSection(i, "title", e.target.value)}
                />
                <button
                  className="admin-icon-btn admin-icon-btn--danger"
                  type="button"
                  aria-label="Remove section"
                  onClick={() => removeSection(i)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <textarea
                className="admin-input"
                rows={2}
                value={s.body}
                placeholder="Section body"
                onChange={(e) => setSection(i, "body", e.target.value)}
              />
            </div>
          ))}
          <button className="admin-btn admin-btn--ghost" type="button" onClick={addSection} style={{ alignSelf: "flex-start" }}>
            <Icon name="plus" size={14} />
            Add section
          </button>
        </div>

        <div className="admin-form-actions" style={{ marginTop: 18 }}>
          <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
            <Icon name="check" size={14} />
            {saving ? "Saving…" : `Save draft`}
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
