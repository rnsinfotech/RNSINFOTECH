import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import { SectionHeader } from "./components/SectionHeader";

import { nav, footer, requestQuote } from "./data/siteData";
import { useSiteSettings } from "./context/SiteSettingsContext";
import { submitLead } from "./lib/api";
import { useToast } from "./context/ToastContext";

const emptyForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  products: "",
  quantity: "",
  message: "",
};

/**
 * RequestQuotePage — where "Request a quote" links across the site
 * point. Optionally pre-fills the "products interested" field from a
 * ?product= query param, so a future "Request quote" button on a
 * product page can deep-link straight into a relevant form. No
 * backend here — submitting simulates a sent request the same way
 * HelpPage's and DemoPage's forms do.
 */
export default function RequestQuotePage() {
  const { support } = useSiteSettings();
  const [searchParams] = useSearchParams();
  const prefillProduct = searchParams.get("product") || "";

  const [form, setForm] = useState({ ...emptyForm, products: prefillProduct });
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
        type: "quote",
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        message: form.message,
        meta: { products: form.products, quantity: form.quantity },
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
      <SEO title={requestQuote.title} description={requestQuote.subtitle} />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">{requestQuote.eyebrow}</span>
          <h1 className="rns-section-title" style={{ marginTop: 8, fontSize: "clamp(28px, 3.6vw, 40px)" }}>
            {requestQuote.title}
          </h1>
          <p style={{ marginTop: 14, fontSize: 15, color: "var(--rns-ink-soft)", lineHeight: 1.6, maxWidth: 560 }}>
            {requestQuote.subtitle}
          </p>
        </div>
      </section>

      <section className="rns-container" style={{ padding: "24px 24px 64px" }}>
        <SectionHeader eyebrow="Get a quote" title="Tell us what you need" />

        <div className="rns-quote-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginTop: 8 }}>
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
                Request received — our sales team will follow up with a quote shortly.
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
                    Company (optional)
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
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    Product(s) interested in
                  </label>
                  <input
                    required
                    value={form.products}
                    onChange={(e) => updateField("products", e.target.value)}
                    placeholder="e.g. SketchDisplay 24 Touch"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => updateField("quantity", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  />
                </div>
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
                {submitting ? "Sending…" : "Send request"}
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
                <Icon name="package" size={19} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--rns-font-display)", marginTop: 14 }}>
                Bulk &amp; institutional pricing
              </div>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--rns-ink-soft)", lineHeight: 1.6 }}>
                Ordering for a classroom, studio, or office? Mention the quantity above and we'll quote bulk pricing.
              </p>
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
                Call or email the team directly and we'll put a quote together.
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
          .rns-quote-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
