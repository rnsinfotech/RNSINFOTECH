import React, { useEffect, useMemo, useState } from "react";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import SEO from "./components/SEO";
import { EmptyState } from "./components/ui/Stateviews";
import { useDebounce } from "./hooks/useDebounce";
import { apiRequest } from "./lib/api";

import { nav, footer, downloads } from "./data/siteData";

/**
 * DownloadsPage — standalone listing of every entry in the `downloads`
 * export, with category filtering + a debounced search over the label
 * (same debounce pattern as ProductsPage's search box). ProductDetailPage
 * already shows the per-product subset (category + universal); this page
 * is the full catalogue for someone who just needs a driver and doesn't
 * want to hunt through a product page to find it.
 *
 * Category filter tabs come from the live catalogue (GET /categories)
 * rather than the mock category list, so they stay in sync with
 * whatever categories actually exist. `downloads` itself has no
 * backend content model yet, so the list of files stays static.
 */
export default function DownloadsPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 250);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let ignore = false;
    apiRequest("/categories")
      .then((res) => {
        if (!ignore) setCategories(res?.items || []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const filters = useMemo(
    () => [
      { id: "all", label: "All downloads" },
      { id: "universal", label: "Universal" },
      ...categories.map((c) => ({ id: c.slug || c._id, label: c.name })),
    ],
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return downloads.filter((d) => {
      const matchesFilter = activeFilter === "all" || d.categoryId === activeFilter;
      const matchesSearch = !q || d.label.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, search]);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Downloads",
      description: "Drivers, manuals, and setup guides for RNS INFOTECH pen displays, pen tablets, stylus pens, and accessories.",
      hasPart: downloads.map((d) => ({
        "@type": "DigitalDocument",
        name: d.label,
        encodingFormat: d.fileType,
      })),
    }),
    []
  );

  return (
    <>
      <SEO
        title="Downloads"
        description="Drivers, manuals, and setup guides for RNS INFOTECH pen displays, pen tablets, stylus pens, and accessories."
        jsonLd={jsonLd}
      />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">Drivers &amp; manuals</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Downloads
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: "var(--rns-ink-soft)", maxWidth: 560 }}>
            Driver installers, user manuals, and setup guides for every product category. Not sure which
            you need? Check the specific product's page — this list is the full catalogue.
          </p>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`rns-tag ${activeFilter === f.id ? "rns-tag--live" : ""}`}
                style={{ cursor: "pointer", border: "1px solid var(--rns-line)" }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
              border: "1px solid var(--rns-line-strong)",
              borderRadius: 20,
              padding: "8px 14px",
              minWidth: 240,
            }}
          >
            <Icon name="search" size={15} style={{ color: "var(--rns-ink-faint)", flexShrink: 0 }} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search downloads..."
              aria-label="Search downloads"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, fontFamily: "var(--rns-font-body)", background: "transparent" }}
            />
          </div>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="download"
            title="No downloads match that search"
            message="Try a different category or search term."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((d) => (
              <a
                key={d.id}
                href={d.href}
                className="rns-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  color: "inherit",
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: "var(--rns-r-sm)",
                    background: "var(--rns-bg-alt)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--rns-ink-soft)",
                  }}
                >
                  <Icon name="fileText" size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                    {d.fileType} · {d.size}
                    {d.version ? ` · ${d.version}` : ""}
                  </div>
                </div>
                <Icon name="download" size={16} style={{ color: "var(--rns-ink-faint)", flexShrink: 0 }} />
              </a>
            ))}
          </div>
        )}
      </section>

      <Footer logo={nav.logo} {...footer} />
    </>
  );
}
