import React, { useEffect, useState } from "react";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";

import { nav, footer } from "./data/siteData";
import { getPolicyContent } from "./lib/contentApi";
import { ErrorState } from "./components/ui/Stateviews";

/**
 * ReturnPolicyPage — explains that RNS INFOTECH doesn't do returns or
 * refunds for change of mind, and that any product issue should go
 * straight to support instead. Mirrors TermsPage / PrivacyPolicyPage's
 * layout; content itself is CMS-driven (see the "returns" policy key).
 */
export default function ReturnPolicyPage() {
  const [policy, setPolicy] = useState(null);
  const [policyError, setPolicyError] = useState(null);

  useEffect(() => { getPolicyContent("returns").then(setPolicy).catch(setPolicyError); }, []);

  if (!policy) return (
    <>
      <SEO title="Returns & product support" noindex />
      <AnnouncementBar />
      <Navbar />
      <section className="rns-section"><div className="rns-container"><ErrorState message={policyError?.message || "Unable to load this policy right now."} /></div></section>
      <Footer logo={nav.logo} {...footer} />
    </>
  );

  return (
    <>
      <SEO title="Returns & product support" description="Our approach to returns and refunds, and how to reach RNS INFOTECH directly if there's an issue with your product." />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 8 }}>
        <div className="rns-container">
        <div style={{ maxWidth: 720 }}>
          <span className="rns-eyebrow">Legal</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Returns &amp; product support
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

      <section className="rns-container" style={{ padding: "16px 24px 64px" }}>
        <div style={{ maxWidth: 720, display: "grid", gap: 28 }}>
          {policy.sections.map((s) => (
            <div key={s.title}>
              <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--rns-font-display)" }}>{s.title}</h2>
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)", lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
