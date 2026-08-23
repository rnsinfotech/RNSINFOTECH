import React, { useState } from "react";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import { SectionHeader } from "./components/SectionHeader";

import { nav, footer, demo } from "./data/siteData";
import { useSiteSettings } from "./context/SiteSettingsContext";
import { submitLead } from "./lib/api";
import { useToast } from "./context/ToastContext";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  interest: demo.interests[0].id,
  mode: demo.modes[0].id,
  preferredDate: "",
  message: "",
};

/**
 * DemoPage — where "Book a demo" (navbar CTA, hero secondary CTA,
 * and the footer's "Demo/Experience Centre" link) all point. Explains
 * what booking a demo involves, then collects a request the same way
 * HelpPage's contact form does: no backend, just a simulated send.
 */
export default function DemoPage() {
  const { support } = useSiteSettings();
  const [form, setForm] = useState(emptyForm);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitLead({
        type: "demo",
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        message: form.message,
        meta: { interest: form.interest, mode: form.mode, preferredDate: form.preferredDate },
      });
      setSent(true);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err?.message || "Couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO title={demo.title} description={demo.subtitle} />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">{demo.eyebrow}</span>
          <h1 className="rns-section-title" style={{ marginTop: 8, fontSize: "clamp(28px, 3.6vw, 40px)" }}>
            {demo.title}
          </h1>
          <p style={{ marginTop: 14, fontSize: 15, color: "var(--rns-ink-soft)", lineHeight: 1.6, maxWidth: 560 }}>
            {demo.subtitle}
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="rns-container" style={{ paddingBottom: 8 }}>
        <div className="rns-grid rns-grid--3">
          {demo.steps.map((s, i) => (
            <div key={s.title} className="rns-card" style={{ padding: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--rns-bg-alt)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--rns-primary)",
                }}
              >
                <Icon name={s.icon} size={19} />
              </div>
              <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 14, fontFamily: "var(--rns-font-mono)" }}>
                Step {i + 1}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginTop: 4 }}>{s.title}</div>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--rns-ink-soft)", lineHeight: 1.55 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Form + experience centre details */}
      <section className="rns-container" style={{ padding: "40px 24px 64px" }}>
        <SectionHeader eyebrow="Request a slot" title="Tell us what you'd like to see" />

        <div className="rns-demo-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginTop: 8 }}>
          <div>
            {sent && (
              <div
                style={{
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--rns-signal-tint)",
                  color: "#0a7a58",
                  borderRadius: "var(--rns-r-sm)",
                  padding: "12px 16px",
                  fontSize: 13.5,
                }}
              >
                <Icon name="check" size={16} />
                Request received — our team will reach out to confirm your slot shortly.
              </div>
            )}

            <form onSubmit={handleSubmit} className="rns-card" style={{ padding: 24, display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    Name
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    Studio / company (optional)
                  </label>
                  <input
                    value={form.company}
                    onChange={(e) => updateField("company", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    What are you interested in?
                  </label>
                  <select
                    value={form.interest}
                    onChange={(e) => updateField("interest", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  >
                    {demo.interests.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    Demo format
                  </label>
                  <select
                    value={form.mode}
                    onChange={(e) => updateField("mode", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  >
                    {demo.modes.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                  Preferred date
                </label>
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => updateField("preferredDate", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5, fontFamily: "var(--rns-font-body)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                  Anything else we should know? (optional)
                </label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => updateField("message", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5, fontFamily: "var(--rns-font-body)", resize: "vertical" }}
                />
              </div>

              <button type="submit" disabled={submitting} className="rns-btn rns-btn--primary" style={{ justifyContent: "center" }}>
                {submitting ? "Sending…" : "Request demo"}
              </button>
            </form>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="rns-card" style={{ padding: 22 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--rns-bg-alt)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--rns-ink)",
                }}
              >
                <Icon name="mapPin" size={19} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--rns-font-display)", marginTop: 14 }}>
                Experience centre
              </div>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--rns-ink-soft)", lineHeight: 1.6 }}>
                {support.address}
              </p>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--rns-ink-soft)" }}>{support.hours}</p>
            </div>

            <div className="rns-card" style={{ padding: 22 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--rns-bg-alt)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--rns-ink)",
                }}
              >
                <Icon name="headset" size={19} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--rns-font-display)", marginTop: 14 }}>
                Prefer to just talk?
              </div>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--rns-ink-soft)", lineHeight: 1.6 }}>
                Call or email the team directly and we'll sort out a time.
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                <a href={`mailto:${support.email}`} className="rns-btn rns-btn--ghost" style={{ justifyContent: "center" }}>
                  {support.email}
                </a>
                <a href={`tel:${support.phone.replace(/\s+/g, "")}`} className="rns-btn rns-btn--ghost" style={{ justifyContent: "center" }}>
                  {support.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        @media (max-width: 800px) {
          .rns-demo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
