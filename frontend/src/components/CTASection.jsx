import React from "react";
import { Link } from "react-router-dom";
import Button from "./Button";

/**
 * CTASection — a bordered call-to-action band with a heading, short
 * body copy, and 1–2 buttons. Reused on the homepage close, plus
 * Corporate Sales / Contact / Warranty pages, so the "get in touch"
 * moment looks consistent site-wide. `tone="dark"` mirrors PromoBanner's
 * ink-on-dark treatment for pages that want a heavier close.
 */
export default function CTASection({
  eyebrow,
  title,
  body,
  primaryCta,
  secondaryCta,
  tone = "dark",
}) {
  const dark = tone === "dark";
  return (
    <section className="rns-container" style={{ padding: "0 24px" }}>
      <div
        className="rns-cta-section"
        style={{
          border: `1px solid ${dark ? "transparent" : "var(--rns-line)"}`,
          borderRadius: "var(--rns-r-lg)",
          background: dark ? "var(--rns-gradient-ink)" : "var(--rns-bg-alt)",
          padding: "48px 32px",
          textAlign: "center",
          margin:"25px"
        }}
      >
        {eyebrow && (
          <span className="rns-eyebrow" style={{ color: dark ? "#9ba3b5" : undefined }}>
            {eyebrow}
          </span>
        )}
        <h2
          style={{
            marginTop: 10,
            fontSize: "clamp(22px, 2.8vw, 30px)",
            color: dark ? "#fff" : "var(--rns-ink)",
            maxWidth: 640,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {title}
        </h2>
        {body && (
          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              color: dark ? "#b7bdc9" : "var(--rns-ink-soft)",
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {body}
          </p>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          {primaryCta && (
            <Button
              as={primaryCta.href?.startsWith("/") ? Link : "a"}
              to={primaryCta.href?.startsWith("/") ? primaryCta.href : undefined}
              href={!primaryCta.href?.startsWith("/") ? primaryCta.href : undefined}
              variant="primary"
              style={dark ? { background: "#fff", color: "var(--rns-ink)" } : undefined}
            >
              {primaryCta.label}
            </Button>
          )}
          {secondaryCta && (
            <Button
              as={secondaryCta.href?.startsWith("/") ? Link : "a"}
              to={secondaryCta.href?.startsWith("/") ? secondaryCta.href : undefined}
              href={!secondaryCta.href?.startsWith("/") ? secondaryCta.href : undefined}
              variant="ghost"
              className={dark ? "rns-cta-ghost-dark" : ""}
              style={dark ? { borderColor: "#454c5c", color: "#fff" } : undefined}
            >
              {secondaryCta.label}
            </Button>
          )}
        </div>
      </div>

      {dark && (
        <style>{`
          /* .rns-btn--ghost's default :hover sets a light background
             (var(--rns-bg-alt)) meant for a light-tone card. On this
             dark CTA band the button's text stays white via inline
             style, so that hover state was rendering white text on a
             near-white background — unreadable. Override it to brighten
             the border/background a touch while keeping the text white. */
          .rns-cta-ghost-dark:hover {
            background: rgba(255, 255, 255, 0.08) !important;
            border-color: #6b7280 !important;
            color: #fff !important;
          }
        `}</style>
      )}
    </section>
  );
}
