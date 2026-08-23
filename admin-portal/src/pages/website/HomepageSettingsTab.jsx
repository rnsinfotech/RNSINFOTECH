import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import FormField from "../../components/FormField";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import { getSettings, updateSettingsSection, publishSettings, getPreview } from "../../services/websiteService";
import HomepagePreviewModal from "./HomepagePreviewModal";
import PageLoader from "../../components/PageLoader";

// Two independent forms (hero/promo) sharing one Save pattern — each
// section saves on its own, so editing the hero doesn't require the
// promo copy to also be touched/valid. The old single-message
// "announcement bar" form that used to live here has been replaced by
// the Flash messages tab (see FlashMessagesTab.jsx), which supports any
// number of rotating messages instead of just one.

function HeroForm({ initial, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setCta(key, field, value) {
    setForm((f) => ({ ...f, [key]: { ...f[key], [field]: value } }));
  }
  function setStat(i, field, value) {
    setForm((f) => ({ ...f, stats: f.stats.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }));
  }
  function addStat() {
    setForm((f) => ({ ...f, stats: [...f.stats, { label: "", value: "" }] }));
  }
  function removeStat(i) {
    setForm((f) => ({ ...f, stats: f.stats.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await updateSettingsSection("hero", form);
      setForm(saved.hero);
      onSaved(saved.hero, "Hero section updated");
    } catch (err) {
      setError(err.message || "Unable to save the hero section. Your edits have not been saved — please retry before leaving this page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>Hero section</h3>
      <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 14 }}>
        The main banner at the top of the homepage.
      </p>
      {error && (
        <div style={{ background: "var(--admin-danger-tint)", color: "var(--admin-danger)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormField label="Title" htmlFor="hero-title" full>
          <textarea id="hero-title" className="admin-input" rows={2} value={form.title} onChange={(e) => set("title", e.target.value)} />
        </FormField>
        <FormField label="Subtitle" htmlFor="hero-subtitle" full>
          <textarea id="hero-subtitle" className="admin-input" rows={2} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
        </FormField>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
          <FormField label="Primary CTA label" htmlFor="hero-p-label">
            <input id="hero-p-label" className="admin-input" value={form.primaryCta.label} onChange={(e) => setCta("primaryCta", "label", e.target.value)} />
          </FormField>
          <FormField label="Primary CTA link" htmlFor="hero-p-href">
            <input id="hero-p-href" className="admin-input" value={form.primaryCta.href} onChange={(e) => setCta("primaryCta", "href", e.target.value)} />
          </FormField>
          <FormField label="Secondary CTA label" htmlFor="hero-s-label">
            <input id="hero-s-label" className="admin-input" value={form.secondaryCta.label} onChange={(e) => setCta("secondaryCta", "label", e.target.value)} />
          </FormField>
          <FormField label="Secondary CTA link" htmlFor="hero-s-href">
            <input id="hero-s-href" className="admin-input" value={form.secondaryCta.href} onChange={(e) => setCta("secondaryCta", "href", e.target.value)} />
          </FormField>
        </div>

        <div className="admin-form-section" style={{ borderTop: "1px solid var(--admin-line)", paddingTop: 14, marginTop: 0 }}>
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Stats</h3>
          {form.stats.map((s, i) => (
            <div className="admin-dyn-row" key={i}>
              <input className="admin-input" style={{ maxWidth: 180 }} value={s.value} onChange={(e) => setStat(i, "value", e.target.value)} placeholder="Value, e.g. 12" />
              <input className="admin-input" value={s.label} onChange={(e) => setStat(i, "label", e.target.value)} placeholder="Label, e.g. Years in operation" />
              <button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => removeStat(i)} aria-label="Remove stat">
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={addStat}>
            <Icon name="plus" size={13} />
            Add stat
          </button>
        </div>
      </div>
      <div className="admin-form-actions" style={{ marginTop: 14, paddingTop: 0, borderTop: "none" }}>
        <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
          <Icon name="check" size={14} />
          {saving ? "Saving…" : "Save hero"}
        </button>
      </div>
    </form>
  );
}

function PromoForm({ initial, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setCta(field, value) {
    setForm((f) => ({ ...f, cta: { ...f.cta, [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await updateSettingsSection("promo", form);
      setForm(saved.promo);
      onSaved(saved.promo, "Promo banner updated");
    } catch (err) {
      setError(err.message || "Unable to save the promo banner. Your edits have not been saved — please retry before leaving this page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Promo banner</h3>
      <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginBottom: 14 }}>
        The mid-page promotional strip between catalogue sections.
      </p>
      {error && (
        <div style={{ background: "var(--admin-danger-tint)", color: "var(--admin-danger)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 2fr" }}>
          <FormField label="Eyebrow" htmlFor="promo-eyebrow">
            <input id="promo-eyebrow" className="admin-input" value={form.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
          </FormField>
          <FormField label="Title" htmlFor="promo-title">
            <input id="promo-title" className="admin-input" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </FormField>
        </div>
        <FormField label="Body" htmlFor="promo-body" full>
          <textarea id="promo-body" className="admin-input" rows={2} value={form.body} onChange={(e) => set("body", e.target.value)} />
        </FormField>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
          <FormField label="CTA label" htmlFor="promo-cta-label">
            <input id="promo-cta-label" className="admin-input" value={form.cta.label} onChange={(e) => setCta("label", e.target.value)} />
          </FormField>
          <FormField label="CTA link" htmlFor="promo-cta-href">
            <input id="promo-cta-href" className="admin-input" value={form.cta.href} onChange={(e) => setCta("href", e.target.value)} />
          </FormField>
        </div>
      </div>
      <div className="admin-form-actions" style={{ marginTop: 14, paddingTop: 0, borderTop: "none" }}>
        <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>
          <Icon name="check" size={14} />
          {saving ? "Saving…" : "Save promo banner"}
        </button>
      </div>
    </form>
  );
}

export default function HomepageSettingsTab() {
  const { toast, showToast, clearToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [preview, setPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  function handleSaved(_section, message) {
    showToast(`${message}. Publish when ready to make it live.`);
  }

  async function handlePreview() {
    try {
      setPreview(await getPreview());
    } catch (err) {
      showToast(err.message || "Unable to load the draft preview.", "danger");
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const next = await publishSettings();
      setSettings((current) => ({ ...current, ...next, publishedWebsite: next }));
      showToast("Homepage published");
    } catch (err) {
      showToast(err.message || "Unable to publish the homepage. Nothing went live — please retry.", "danger");
    } finally {
      setPublishing(false);
    }
  }

  if (!settings) {
    return <PageLoader />;
  }

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3>Homepage publishing</h3>
          <p style={{ fontSize: 12.5, color: "var(--admin-ink-faint)", marginTop: 4 }}>Edits are saved as a draft. The storefront serves only the published snapshot.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={handlePreview}>Preview draft</button>
          <button className="admin-btn admin-btn--primary" type="button" onClick={handlePublish} disabled={publishing}>{publishing ? "Publishing…" : "Publish homepage"}</button>
        </div>
      </div>
      <HeroForm initial={settings.hero} onSaved={handleSaved} />
      <PromoForm initial={settings.promo} onSaved={handleSaved} />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
      {preview && <HomepagePreviewModal website={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
