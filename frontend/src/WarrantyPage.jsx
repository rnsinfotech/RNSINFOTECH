import React, { useEffect, useState } from "react";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CTASection from "./components/CTASection";
import SEO from "./components/SEO";

import { nav, footer } from "./data/siteData";
import { useSiteSettings } from "./context/SiteSettingsContext";
import { getPolicyContent } from "./lib/contentApi";
import { ErrorState } from "./components/ui/Stateviews";

/**
 * WarrantyPage — mirrors ReturnPolicyPage/TermsPage's layout (same
 * `updated`/`intro`/`sections` shape in siteData.js), plus a per-category
 * coverage table derived from `policy.coverage || []` and a "file a claim"
 * CTASection at the bottom. This is what the footer's "Warranty claim"
 * link and HelpPage's warranty quick-link both point to as of Phase 6.
 */
export default function WarrantyPage() {
  const { support } = useSiteSettings();
  const [policy, setPolicy] = useState(null);
  const [policyError, setPolicyError] = useState(null);

  useEffect(() => { getPolicyContent("warranty").then(setPolicy).catch(setPolicyError); }, []);

  if (!policy) return (
    <>
      <SEO title="Warranty policy" noindex />
      <AnnouncementBar />
      <Navbar />
      <section className="rns-section"><div className="rns-container"><div className="rns-card" style={{ padding: 28 }}>Unable to load the warranty policy right now.</div></div></section>
      <Footer logo={nav.logo} {...footer} />
    </>
  );

  return (
    <>
      <SEO
        title="Warranty"
        description="Warranty coverage and claim process for pen displays, pen tablets, stylus pens, and accessories sold by RNS INFOTECH."
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 8 }}>
        <div className="rns-container">
          <div style={{ maxWidth: 720 }}>
            <span className="rns-eyebrow">Legal</span>
            <h1 className="rns-section-title" style={{ marginTop: 8 }}>
              Warranty policy
            </h1>
            <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--rns-ink-faint)" }}>
              Last updated {policy.updated}
            </p>
            <p style={{ marginTop: 16, fontSize: 14.5, color: "var(--rns-ink-soft)", lineHeight: 1.65 }}>
              {policy.intro}
            </p>
          </div>
        </div>
      </section>

      {/* Coverage table */}
      <section className="rns-container" style={{ paddingTop: 8, paddingBottom: 8 }}>
        <div style={{ maxWidth: 720 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--rns-font-display)", marginBottom: 14 }}>
            Coverage by category
          </h2>
          <div className="rns-card" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "var(--rns-bg-alt)" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Category</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Duration</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(policy.coverage || []).map((row, i) => (
                  <tr key={row.categoryId} style={{ borderTop: i > 0 ? "1px solid var(--rns-line)" : "none" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500, whiteSpace: "nowrap" }}>{row.categoryLabel}</td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{row.duration}</td>
                    <td style={{ padding: "12px 16px", color: "var(--rns-ink-soft)" }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rns-container" style={{ padding: "16px 24px 48px" }}>
        <div style={{ maxWidth: 720, display: "grid", gap: 28 }}>
          {policy.sections.map((s) => (
            <div key={s.title}>
              <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--rns-font-display)" }}>{s.title}</h2>
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)", lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <CTASection
        eyebrow="Need to file a claim?"
        title="Email your order ID and we'll take it from there"
        body="Include your order ID, the product's serial number, and a short description (photos or video help) — a specialist confirms coverage within one business day."
        primaryCta={{ label: `Email ${support.email}`, href: `mailto:${support.email}?subject=Warranty claim` }}
        secondaryCta={{ label: "Track an order", href: "/orders" }}
      />

      <div style={{ height: 56 }} />

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
