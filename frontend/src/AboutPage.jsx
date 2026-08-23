import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import WhyChooseUs from "./components/WhyChooseUs";
import Testimonials from "./components/Testimonials";
import { SectionHeader, Trace } from "./components/SectionHeader";
import { apiRequest } from "./lib/api";

import { nav, footer, about } from "./data/siteData";

/**
 * AboutPage — the brand story. Reuses WhyChooseUs / Testimonials rather
 * than rebuilding them, so this page stays in sync with the same
 * content shown on the homepage instead of drifting into a second copy
 * of "why choose us" — both now pulled live from GET /website, same as
 * HomePage. `about` (intro/story/values copy) has no backend content
 * model yet, so it stays static.
 */
export default function AboutPage() {
  const [website, setWebsite] = useState({ hero: null, whyChooseUs: [], testimonials: [] });

  useEffect(() => {
    let ignore = false;
    apiRequest("/website")
      .then((res) => {
        if (!ignore) setWebsite(res?.website || { hero: null, whyChooseUs: [], testimonials: [] });
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <SEO title="About us" description={about.intro} />
      <AnnouncementBar />
      <Navbar {...nav} />

      {/* Intro */}
      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
        <div style={{ maxWidth: 760 }}>
          <span className="rns-eyebrow">{about.eyebrow}</span>
          <h1 className="rns-section-title" style={{ marginTop: 8, fontSize: "clamp(28px, 3.6vw, 40px)" }}>
            {about.title}
          </h1>
          <p style={{ marginTop: 16, fontSize: 15.5, color: "var(--rns-ink-soft)", lineHeight: 1.6 }}>
            {about.intro}
          </p>

          {website.hero?.stats && (
            <div
              style={{
                display: "flex",
                gap: 32,
                marginTop: 28,
                paddingTop: 22,
                borderTop: "1px solid var(--rns-line)",
                flexWrap: "wrap",
              }}
            >
              {website.hero.stats.map((s) => (
                <div key={s.label}>
                  <div style={{ fontFamily: "var(--rns-font-display)", fontSize: 26, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "var(--rns-ink-faint)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </section>

      {/* Story */}
      <section className="rns-section">
        <div className="rns-container">
        <div style={{ maxWidth: 720 }}>
          {about.story.map((para, i) => (
            <p key={i} style={{ fontSize: 15, lineHeight: 1.75, color: "var(--rns-ink-soft)", marginTop: i === 0 ? 0 : 16 }}>
              {para}
            </p>
          ))}
        </div>
        </div>
      </section>

      <div className="rns-container" style={{ padding: "0 24px" }}>
        <Trace nodes={4} />
      </div>

      {/* Values */}
      <section className="rns-section rns-section--alt">
        <div className="rns-container">
          <SectionHeader eyebrow="What we stand for" title="How we run RNS INFOTECH" />
          <div className="rns-grid rns-grid--3">
            {about.values.map((v) => (
              <div key={v.title} style={{ padding: "4px 0" }}>
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
                  <Icon name={v.icon} size={20} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 16 }}>{v.title}</div>
                <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WhyChooseUs items={website.whyChooseUs} />
      <Testimonials items={website.testimonials} />

      {/* CTA */}
      <section className="rns-container" style={{ padding: "8px 24px 64px" }}>
        <div
          className="rns-card"
          style={{
            padding: "32px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--rns-font-display)" }}>
              Questions before you buy?
            </div>
            <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--rns-ink-soft)" }}>
              Reach the team by email, live chat, or phone — we're happy to help you pick the right model.
            </p>
          </div>
          <Link to="/help" className="rns-btn rns-btn--primary">
            Get in touch
          </Link>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
