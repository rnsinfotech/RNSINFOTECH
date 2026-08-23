import React from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";

import { nav, footer } from "./data/siteData";

/**
 * NotFoundPage — catch-all route ("*") for any unmatched URL.
 */
export default function NotFoundPage() {
  return (
    <>
      <SEO title="Page not found" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section
        className="rns-container"
        style={{
          padding: "96px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "var(--rns-bg-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--rns-ink)",
          }}
        >
          <Icon name="mapPin" size={24} />
        </div>
        <div style={{ fontFamily: "var(--rns-font-mono)", fontSize: 13, color: "var(--rns-ink-faint)" }}>
          404
        </div>
        <h1 className="rns-section-title">Page not found</h1>
        <p style={{ fontSize: 14.5, color: "var(--rns-ink-soft)", maxWidth: 420 }}>
          The page you're looking for doesn't exist or may have moved. Try the catalogue, or head back home.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Link to="/" className="rns-btn rns-btn--primary">
            Back to home
          </Link>
          <Link to="/products" className="rns-btn rns-btn--ghost">
            Browse products
          </Link>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
