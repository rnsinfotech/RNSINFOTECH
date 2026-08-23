import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import FAQs from "./components/FAQs";
import { useLiveChat } from "./context/LiveChatContext";

import { nav, footer } from "./data/siteData";
import { useSiteSettings } from "./context/SiteSettingsContext";
import { getFaqContent } from "./lib/contentApi";
import { submitLead } from "./lib/api";
import { useToast } from "./context/ToastContext";
import { ErrorState } from "./components/ui/Stateviews";

function ContactCard({ icon, title, description, action }) {
  return (
    <div className="rns-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
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
        <Icon name={icon} size={19} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--rns-font-display)" }}>{title}</div>
        <p style={{ marginTop: 6, fontSize: 13, color: "var(--rns-ink-soft)", lineHeight: 1.55 }}>{description}</p>
      </div>
      <div style={{ marginTop: "auto" }}>{action}</div>
    </div>
  );
}

/**
 * HelpPage — the single place "Support" / "Contact" links across the
 * site point to: how to reach RNS INFOTECH (email, live chat, phone),
 * order/warranty shortcuts, the existing FAQ list, and a fallback
 * contact form. Email and phone are real mailto:/tel: links; live
 * chat opens the same LiveChatWidget that's available everywhere else
 * in the app.
 */
export default function HelpPage() {
  const { support } = useSiteSettings();
  const [faqs, setFaqs] = useState([]);
  const [faqError, setFaqError] = useState(null);

  useEffect(() => {
    getFaqContent().then(setFaqs).catch(setFaqError);
  }, []);
  const { openChat } = useLiveChat();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
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
        type: "contact",
        name: form.name,
        email: form.email,
        message: form.message,
        meta: { subject: form.subject },
      });
      setSent(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      toast.error(err?.message || "Couldn't send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEO
        title="Help & support"
        description="Reach the RNS INFOTECH team by email or live chat, or browse answers to common questions."
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">We're here to help</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Help &amp; support
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: "var(--rns-ink-soft)", maxWidth: 560 }}>
            Reach the RNS INFOTECH team by email or live chat, or browse answers to common questions below.
          </p>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 20 }}>
        <div className="rns-help-contact-grid">
          <ContactCard
            icon="mail"
            title="Email us"
            description={`Send the details of what you need and we'll get back to you. ${support.emailResponseTime}.`}
            action={
              <a href={`mailto:${support.email}`} className="rns-btn rns-btn--primary" style={{ width: "100%", justifyContent: "center" }}>
                {support.email}
              </a>
            }
          />
          <ContactCard
            icon="message"
            title="Live chat"
            description={`Chat with our support widget right on the site. ${support.chatResponseTime}.`}
            action={
              <button onClick={openChat} className="rns-btn rns-btn--primary" style={{ width: "100%", justifyContent: "center" }}>
                Start live chat
              </button>
            }
          />
          <ContactCard
            icon="phone"
            title="Call us"
            description={`Speak to the team directly. ${support.hours}.`}
            action={
              <a href={`tel:${support.phone.replace(/\s+/g, "")}`} className="rns-btn rns-btn--primary" style={{ width: "100%", justifyContent: "center" }}>
                {support.phone}
              </a>
            }
          />
        </div>
      </section>

      {/* Quick links */}
      <section className="rns-container" style={{ paddingBottom: 20 }}>
        <div className="rns-card" style={{ padding: 22 }}>
          <h2 style={{ fontSize: 15, fontFamily: "var(--rns-font-display)", fontWeight: 600 }}>Quick links</h2>
          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Track an order</div>
                <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                  See live status, shipping, and invoice download once shipped.
                </div>
              </div>
              <Link to="/orders" className="rns-btn rns-btn--ghost">
                My orders
              </Link>
            </div>

            <div id="warranty" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid var(--rns-line)" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Warranty claim</div>
                <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 2, maxWidth: 420 }}>
                  Manufacturer warranty applies as standard (1–2 years depending on model). RNS handles the claim directly rather than redirecting you to the brand.
                </div>
              </div>
              <Link to="/warranty" className="rns-btn rns-btn--ghost">
                View warranty policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      {faqError ? <ErrorState message={faqError.message} action={{ label: "Retry FAQs", onClick: () => window.location.reload() }} /> : <FAQs items={faqs} />}

      {/* Contact form */}
      <section className="rns-container" style={{ padding: "56px 24px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <span className="rns-eyebrow">Still stuck?</span>
          <h2 className="rns-section-title" style={{ marginTop: 8 }}>
            Send us a message
          </h2>

          {sent && (
            <div
              style={{
                marginTop: 16,
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
              Message sent — our support team typically replies within one business day.
            </div>
          )}

          <form onSubmit={handleSubmit} className="rns-card" style={{ padding: 24, marginTop: 16, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>Subject</label>
              <input
                required
                value={form.subject}
                onChange={(e) => updateField("subject", e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, color: "var(--rns-ink-soft)", marginBottom: 6 }}>Message</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => updateField("message", e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5, fontFamily: "var(--rns-font-body)", resize: "vertical" }}
              />
            </div>
            <button type="submit" disabled={submitting} className="rns-btn rns-btn--primary" style={{ justifyContent: "center" }}>
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        .rns-help-contact-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 760px) {
          .rns-help-contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
