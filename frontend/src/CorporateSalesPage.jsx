import React from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CTASection from "./components/CTASection";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import { SectionHeader } from "./components/SectionHeader";
import Reveal from "./components/ui/Reveal";

import { nav, footer, corporateSales } from "./data/siteData";

/**
 * CorporateSalesPage — the marketing/value-prop page "Corporate sales"
 * links across the site point to. Deliberately doesn't duplicate
 * RequestQuotePage's form (which already covers bulk pricing well) —
 * this page explains *why* to buy through RNS for a team, then funnels
 * into that same form via CTASection, so there's one quote flow, not two.
 */
export default function CorporateSalesPage() {
  return (
    <>
      <SEO
        title="Corporate & Bulk Sales"
        description="Volume pricing, GST invoicing, and a dedicated account contact for studios, offices, and institutions buying pen tablets and displays in bulk from RNS INFOTECH."
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">{corporateSales.eyebrow}</span>
          <h1 className="rns-section-title" style={{ marginTop: 8, fontSize: "clamp(28px, 3.6vw, 40px)" }}>
            {corporateSales.title}
          </h1>
          <p style={{ marginTop: 14, fontSize: 15, color: "var(--rns-ink-soft)", lineHeight: 1.6, maxWidth: 620 }}>
            {corporateSales.subtitle}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <Link to="/request-quote" className="rns-btn rns-btn--primary">
              Request a quote
            </Link>
            <Link to="/demo" className="rns-btn rns-btn--ghost">
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="rns-section">
        <div className="rns-container">
          <SectionHeader eyebrow="Why buy through RNS" title="Built for team and institutional purchasing" />
          <div className="rns-grid rns-grid--3">
            {corporateSales.benefits.map((b, i) => (
              <Reveal key={b.title} delay={Math.min(i, 3)} style={{ padding: "4px 0" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    border: "1px solid var(--rns-line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--rns-primary)",
                  }}
                >
                  <Icon name={b.icon} size={20} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 16 }}>{b.title}</div>
                <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>{b.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="rns-section rns-section--alt">
        <div className="rns-container">
          <SectionHeader eyebrow="Process" title="How a bulk order comes together" />
          <div
            className="rns-grid rns-grid--3"
            style={{ position: "relative" }}
          >
            {corporateSales.steps.map((s, i) => (
              <Reveal key={s.title} delay={Math.min(i, 3)} style={{ padding: "4px 0" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--rns-ink)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--rns-font-mono)",
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <Icon name={s.icon} size={20} style={{ color: "var(--rns-primary)" }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 16 }}>{s.title}</div>
                <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        eyebrow="Ready when you are"
        title="Tell us what your team needs"
        body="Products, quantities, and timeline — we'll come back with a line-item quote, usually within one business day."
        primaryCta={{ label: "Request a quote", href: "/request-quote" }}
        secondaryCta={{ label: "Book a demo", href: "/demo" }}
        tone="dark"
      />

      <div style={{ height: 56 }} />

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
