import React, { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useToast } from "../context/ToastContext";
import { submitLead } from "../lib/api";

/** FooterLink — internal (path-starting) hrefs render as a router Link;
 * anything else (mailto:, tel:, external URLs, hash-only placeholders)
 * falls back to a plain <a>. Same convention as SectionHeader/CTASection. */
function FooterLink({ href, children, className, style }) {
  const isInternal = href?.startsWith("/");
  return isInternal ? (
    <Link to={href} className={className} style={style}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  );
}

function ContactLine({ icon, children, href }) {
  const content = (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "#1a1e29",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8ea2ff",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={13} />
      </span>
      <span style={{ lineHeight: 1.5 }}>{children}</span>
    </>
  );
  const rowStyle = { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#9ba3b5" };
  return href ? (
    <a href={href} className="rns-footer-link" style={rowStyle}>
      {content}
    </a>
  ) : (
    <div style={rowStyle}>{content}</div>
  );
}

function NewsletterForm({ newsletter }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await submitLead({ type: "newsletter", email: trimmed });
      setEmail("");
      toast.success(`Subscribed ${trimmed} for restock alerts & offers.`);
    } catch (err) {
      toast.error(err?.message || "Couldn't subscribe right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
      <div className="rns-footer-newsletter-form" style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={newsletter.placeholder}
          aria-label="Email address for newsletter"
          style={{
            flex: 1,
            minWidth: 0,
            background: "#1a1e29",
            border: "1px solid #2c313e",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            color: "#fff",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          style={{
            flexShrink: 0,
            background: "var(--rns-primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "…" : newsletter.cta}
        </button>
      </div>
    </form>
  );
}

export default function Footer({ logo, about, columns, legal, newsletter, social, whyChooseUs = [] }) {
  const { support } = useSiteSettings();
  return (
    <footer style={{ background: "var(--rns-bg-ink)", color: "#c7cbd6", position: "relative" }}>
      <div
        aria-hidden="true"
        style={{
          height: 3,
          background: "linear-gradient(90deg, var(--rns-primary), #12b886 55%, transparent)",
        }}
      />

      {/* Trust badges — same copy/icon vocabulary as the homepage's
          WhyChooseUs section, condensed into a single row for the footer. */}
      {whyChooseUs?.length > 0 && (
        <div style={{ borderBottom: "1px solid #21252f" }}>
          <div
            className="rns-container rns-footer-trust"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${whyChooseUs.length}, 1fr)`,
              gap: 20,
              padding: "22px 24px",
              rowGap: 16,
            }}
          >
            {whyChooseUs.map((f) => (
              <div key={f.title} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#1a1e29",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#8ea2ff",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={f.icon} size={15} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "#c7cbd6" }}>{f.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rns-container" style={{ padding: "56px 24px 28px" }}>
        <div className="rns-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 0.85fr 0.85fr 0.85fr 1.05fr", gap: 32 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#fff",
                  borderRadius: 9,
                  padding: "6px 8px",
                  lineHeight: 0,
                }}
              >
                <img src="/rns_logo.jpg" alt="" style={{ height: 22, display: "block" }} />
              </span>
              <span style={{ fontFamily: "var(--rns-font-display)", fontWeight: 700, fontSize: 16.5, color: "#fff", letterSpacing: "-0.01em" }}>
                {logo}
              </span>
            </div>

            <p style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.65, maxWidth: 300, color: "#9ba3b5" }}>{about}</p>

            {social?.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                {social.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    title={s.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#1a1e29",
                      color: "#9ba3b5",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "color 0.15s ease, background 0.15s ease",
                    }}
                    className="rns-footer-social"
                  >
                    <Icon name={s.icon} size={15} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 16,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {col.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {col.links.map((l) => (
                  <FooterLink key={l.label} href={l.href} className="rns-footer-link" style={{ fontSize: 13.5, color: "#9ba3b5" }}>
                    {l.label}
                  </FooterLink>
                ))}
              </div>
            </div>
          ))}

          {/* Get in touch */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Get in touch
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ContactLine icon="mail" href={`mailto:${support.email}`}>
                {support.email}
              </ContactLine>
              <ContactLine icon="phone" href={`tel:${support.phone.replace(/\s+/g, "")}`}>
                {support.phone}
              </ContactLine>
              <ContactLine icon="mapPin">{support.address}</ContactLine>
              <ContactLine icon="calendar">{support.hours}</ContactLine>
            </div>

            {newsletter && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {newsletter.title}
                </div>
                <p style={{ marginTop: 8, fontSize: 12.5, color: "#767d8c", lineHeight: 1.5 }}>{newsletter.body}</p>
                <NewsletterForm newsletter={newsletter} />
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 22,
            borderTop: "1px solid #262a35",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12.5,
            color: "#767d8c",
          }}
        >
          <span>© {new Date().getFullYear()} RNS INFOTECH. All rights reserved.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {legal.map((l, i) => (
              <React.Fragment key={l.label}>
                {i > 0 && <span style={{ color: "#3a3f4d" }}>·</span>}
                <FooterLink href={l.href} className="rns-footer-link" style={{ color: "#767d8c" }}>
                  {l.label}
                </FooterLink>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .rns-footer-link { transition: color 0.15s ease; }
        .rns-footer-link:hover { color: #ffffff !important; }
        .rns-footer-social:hover { color: #fff !important; background: var(--rns-primary) !important; }

        @media (max-width: 980px) {
          .rns-footer-grid { grid-template-columns: 1fr 1fr 1fr !important; }
          .rns-footer-grid > div:first-child { grid-column: 1 / -1; }
          .rns-footer-trust { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 620px) {
          .rns-footer-grid { grid-template-columns: 1fr 1fr !important; }
          .rns-footer-grid > div:first-child { grid-column: 1 / -1; }
          .rns-footer-trust { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          /* Two cramped columns on a small phone (~360-400px wide, minus
             padding and a 32px gap) leaves each column ~150px, which is
             too tight for the "Get in touch" block and the newsletter
             form — inputs/buttons end up squeezed and wrapping oddly.
             Stack everything into one column instead. */
          .rns-footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .rns-footer-grid > div:first-child { grid-column: auto; }
          .rns-footer-newsletter-form { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>
    </footer>
  );
}
