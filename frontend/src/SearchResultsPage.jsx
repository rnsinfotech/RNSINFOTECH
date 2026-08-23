import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";

import { nav, footer } from "./data/siteData";
import { searchSite, useSearchIndex, TYPE_LABELS } from "./lib/search";

const TYPE_ORDER = ["product", "category", "service", "faq", "page"];

function ResultRow({ item }) {
  return (
    <Link
      to={item.href}
      className="rns-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 14,
        color: "inherit",
      }}
    >
      {item.image ? (
        <img
          src={item.image}
          alt=""
          style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "var(--rns-bg-alt)" }}
        />
      ) : (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 8,
            background: "var(--rns-bg-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "var(--rns-ink-faint)",
          }}
        >
          <Icon name="search" size={18} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500 }}>{item.title}</div>
        {item.subtitle && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--rns-ink-soft)",
              marginTop: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {item.subtitle}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";

  const index = useSearchIndex();
  const results = useMemo(() => searchSite(q, index), [q, index]);

  const grouped = useMemo(() => {
    const map = {};
    results.forEach((item) => {
      if (!map[item.type]) map[item.type] = [];
      map[item.type].push(item);
    });
    return map;
  }, [results]);

  return (
    <>
      <SEO
        title={q ? `Search results for "${q}"` : "Search"}
        description={
          q
            ? `${results.length} result${results.length === 1 ? "" : "s"} for "${q}" across products, services, and help articles at RNS INFOTECH.`
            : "Search RNS INFOTECH's catalogue of pen tablets, pen displays, stylus pens, and accessories."
        }
        noindex
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">Search</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            {q ? `Results for "${q}"` : "Search RNS INFOTECH"}
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: "var(--rns-ink-soft)" }}>
            {q
              ? `${results.length} result${results.length === 1 ? "" : "s"} across products, services, and help articles.`
              : "Try the search bar above to find a product, service, or help article."}
          </p>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        {q && results.length === 0 && (
          <div
            style={{
              border: "1px solid var(--rns-line)",
              borderRadius: 12,
              padding: "56px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 16 }}>No results for "{q}"</div>
            <p style={{ marginTop: 8, fontSize: 14, color: "var(--rns-ink-soft)" }}>
              Try a different word, or browse the{" "}
              <Link to="/products" style={{ color: "var(--rns-primary)" }}>
                full catalogue
              </Link>
              .
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {TYPE_ORDER.filter((type) => grouped[type]?.length).map((type) => (
            <div key={type}>
              <h2
                style={{
                  fontSize: 13,
                  fontFamily: "var(--rns-font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--rns-ink-faint)",
                  marginBottom: 12,
                }}
              >
                {TYPE_LABELS[type]} · {grouped[type].length}
              </h2>
              <div className="rns-search-results-grid" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, 1fr)" }}>
                {grouped[type].map((item) => (
                  <ResultRow key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        @media (max-width: 700px) {
          .rns-search-results-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
