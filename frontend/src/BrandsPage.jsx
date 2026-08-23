import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import { EmptyState, ErrorState } from "./components/ui/Stateviews";
import { SkeletonProductGrid } from "./components/ui/Skeleton";
import { apiRequest, normalizeProduct } from "./lib/api";

import { nav, footer } from "./data/siteData";

function BrandCard({ name, logo }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rns-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {logo && !imgFailed ? (
          <img
            src={logo}
            alt={`${name} logo`}
            onError={() => setImgFailed(true)}
            style={{ height: 48, width: "auto", maxWidth: 160, objectFit: "contain" }}
          />
        ) : (
          <div
            style={{
              height: 40,
              width: 40,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--rns-ink-soft)",
              color: "var(--rns-bg)",
              fontFamily: "var(--rns-font-display)",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {initials}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--rns-font-display)" }}>{name}</div>
        <p style={{ marginTop: 6, fontSize: 13, color: "var(--rns-ink-soft)", lineHeight: 1.55 }}>
          Genuine {name} hardware, sourced through authorized channels — with warranty claims handled directly by RNS INFOTECH.
        </p>
      </div>
      <div style={{ marginTop: "auto" }}>
        <Link
          to={`/products?brand=${encodeURIComponent(name)}`}
          className="rns-btn rns-btn--ghost"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Browse {name} products
        </Link>
      </div>
    </div>
  );
}

/**
 * BrandsPage — a dedicated listing of the brand partners RNS INFOTECH
 * carries. There's no public storefront endpoint for brands (only
 * admin CRUD — see MOCK_DATA_CLEANUP_PROGRESS.md), so instead of a
 * dedicated fetch, the brand list is derived from the live product
 * catalogue's `brand` field (GET /products, same "whole catalogue"
 * call ProductsPage/search already make with limit=200). Each card
 * links into /products with that brand pre-selected as a filter
 * (?brand=<name>).
 */
export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setLoadError(null);
        const productsRes = await apiRequest("/products?page=1&limit=200");
        if (ignore) return;

        const names = new Set(
          (productsRes?.items || [])
            .map((p) => normalizeProduct(p).brand)
            .filter(Boolean)
        );
        setBrands([...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ name })));
      } catch (error) {
        if (!ignore) setLoadError(error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <SEO
        title="Brands we carry"
        description="Every RNS INFOTECH unit is sourced through authorized brand channels, with warranty claims handled directly by our own team."
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">Authorized dealer</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Brands we carry
          </h1>
          <p style={{ marginTop: 12, fontSize: 14.5, color: "var(--rns-ink-soft)", lineHeight: 1.6, maxWidth: 640 }}>
            Every unit is sourced through authorized brand channels — no grey-market imports — and every warranty
            claim is handled by our own team instead of redirecting you to the manufacturer.
          </p>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 40 }}>
        {loading ? (
          <SkeletonProductGrid count={8} columns={4} />
        ) : loadError ? (
          <ErrorState message="Brands couldn't be loaded right now." />
        ) : brands.length === 0 ? (
          <EmptyState
            title="No brands to show yet"
            message="Check back soon — brand partners will appear here as products are added."
          />
        ) : (
          <div className="rns-grid rns-grid--4">
            {brands.map((b) => (
              <BrandCard key={b.name} {...b} />
            ))}
          </div>
        )}
      </section>

      <section className="rns-container" style={{ padding: "8px 24px 64px" }}>
        <div
          className="rns-card"
          style={{
            padding: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
                flexShrink: 0,
              }}
            >
              <Icon name="shield" size={19} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--rns-font-display)" }}>
                Not sure which brand fits your work?
              </div>
              <p style={{ marginTop: 4, fontSize: 13.5, color: "var(--rns-ink-soft)" }}>
                Tell us what you're after and we'll recommend the right model.
              </p>
            </div>
          </div>
          <Link to="/request-quote" className="rns-btn rns-btn--primary">
            Request a quote
          </Link>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
