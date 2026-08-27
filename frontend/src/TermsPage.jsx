import React, { useEffect, useState } from "react";
import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import { nav, footer } from "./data/siteData";
import { getPolicyContent } from "./lib/contentApi";
import { ErrorState } from "./components/ui/Stateviews";

export default function TermsPage() {
  const [policy, setPolicy] = useState(null);
  const [policyError, setPolicyError] = useState(null);
  useEffect(() => { getPolicyContent("terms").then(setPolicy).catch(setPolicyError); }, []);
  if (!policy) return (<><SEO title="Terms policy" noindex /><AnnouncementBar /><Navbar {...nav} /><section className="rns-section"><div className="rns-container"><ErrorState message={policyError?.message || "Unable to load this policy right now."} /></div></section><Footer logo={nav.logo} {...footer} /></>);
  return (<><SEO title="Terms & conditions" description="The terms that govern use of the RNS INFOTECH website and orders placed through it." /><AnnouncementBar /><Navbar {...nav} />
    <section className="rns-section"><div className="rns-container"><div style={{ maxWidth: 900 }}><span className="rns-eyebrow">Legal</span><h1 className="rns-section-title" style={{ marginTop: 8 }}>Terms &amp; conditions</h1><p style={{ marginTop: 10, fontSize: 12.5, color: "var(--rns-ink-faint)" }}>Last updated {policy.updated}</p></div></div></section>
    <section className="rns-container" style={{ padding: "8px 24px 64px" }}><article style={{ maxWidth: 900, fontSize: 14.5, color: "var(--rns-ink-soft)", lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{policy.description || ""}</article></section>
    <Footer logo={nav.logo} {...footer} /></>);
}
